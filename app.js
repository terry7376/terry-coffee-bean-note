/****************************
 * 공유형 Firebase 버전
 * - 모든 데이터는 Firebase Realtime Database에 저장/수정/삭제
 * - beansData는 DB에서 실시간으로 받아온 최신 스냅샷
 * - localStorage는 더 이상 "진짜 저장소"가 아님 (백업 용으로만 사용)
 ****************************/

/****************************
 * 🔒 잠금 / 접근 제어
 ****************************/
const MASTER_PASSWORD = "9494"; // 초기 비밀번호

const lockScreen = document.getElementById("lockScreen");
const appWrapper = document.getElementById("appWrapper");
const unlockPasswordInput = document.getElementById("unlockPassword");
const unlockButton = document.getElementById("unlockButton");
const lockError = document.getElementById("lockError");

function tryUnlock() {
  const entered = unlockPasswordInput.value.trim();

  if (entered === MASTER_PASSWORD) {
    lockScreen.style.display = "none";
    appWrapper.style.display = "block";
  } else {
    lockError.style.display = "block";
    unlockPasswordInput.value = "";
    unlockPasswordInput.focus();
  }
}

unlockButton.addEventListener("click", tryUnlock);
unlockPasswordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryUnlock();
});

/****************************
 * 🧭 탭 전환 (기록하기 / 리스트)
 ****************************/
const tabWriteBtn = document.getElementById("tabWrite");
const tabListBtn = document.getElementById("tabList");

const pageWrite = document.getElementById("pageWrite");
const pageList = document.getElementById("pageList");

function showWritePage() {
  pageWrite.style.display = "block";
  pageList.style.display = "none";
  tabWriteBtn.classList.add("tab-active");
  tabListBtn.classList.remove("tab-active");
}

function showListPage() {
  pageWrite.style.display = "none";
  pageList.style.display = "block";
  tabListBtn.classList.add("tab-active");
  tabWriteBtn.classList.remove("tab-active");

  // 리스트 페이지 열릴 때마다 필터 적용
  applyFilter();
}

tabWriteBtn.addEventListener("click", showWritePage);
tabListBtn.addEventListener("click", showListPage);

/****************************
 * ☕ 커피 노트 데이터 & 폼
 ****************************/
let beansData = [];        // Firebase에서 실시간으로 받아온 배열
let editTargetId = null;   // 현재 수정 중인 bean의 id (null이면 새 작성 모드)
let currentImageData = ""; // 현재 선택/유지 중인 이미지(base64)

const beanNameInput = document.getElementById("beanName");
const beanBrandInput = document.getElementById("beanBrand");
const roastLevelInput = document.getElementById("roastLevel");
const acidityInput = document.getElementById("acidity");
const bodyInput = document.getElementById("body");
const ratingInput = document.getElementById("rating");
const flavorNotesInput = document.getElementById("flavorNotes");
const myNotesInput = document.getElementById("myNotes");

const beanImageInput = document.getElementById("beanImage");
const imagePreviewEl = document.getElementById("imagePreview");

const saveButton = document.getElementById("saveButton");
const updateButton = document.getElementById("updateButton");

/* 리스트/필터 관련 DOM */
const filterBrandInput = document.getElementById("filterBrand");
const filterAcidityInput = document.getElementById("filterAcidity");
const filterBodyInput = document.getElementById("filterBody");
const applyFilterButton = document.getElementById("applyFilterButton");
const clearFilterButton = document.getElementById("clearFilterButton");

const filteredList = document.getElementById("filteredList");

/* 백업/복원/이메일 DOM */
const exportButton = document.getElementById("exportButton");
const importButton = document.getElementById("importButton");
const importFileInput = document.getElementById("importFileInput");
const emailBackupButton = document.getElementById("emailBackupButton");

/****************************
 * Firebase Realtime Database 참조
 ****************************/
const beansRef = firebase.database().ref("beans");

/****************************
 * 초기화
 * - Firebase에서 beans 데이터를 실시간 구독
 * - 화면은 기본적으로 "기록하기" 탭을 먼저 보여줌
 ****************************/
init();
function init() {
  // Firebase에서 데이터 실시간으로 감시
  beansRef.on("value", (snapshot) => {
    const dataObj = snapshot.val() || {};
    // dataObj는 { "someId": {...}, "anotherId": {...} }
    beansData = Object.keys(dataObj).map((key) => dataObj[key]);

    // 로컬 백업용으로도 저장(옵션): 혹시 오프라인 참고
    localStorage.setItem("myCoffeeBeans_backup", JSON.stringify(beansData));

    // 현재 보이는 페이지가 리스트라면 갱신
    applyFilter();
  });

  resetFormState();
  showWritePage();
}

/****************************
 * 이미지 처리 (512x512 정사각 리사이즈)
 ****************************/
function resizeImageToSquare(file, size = 512) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");

        const originalW = img.width;
        const originalH = img.height;
        const aspect = originalW / originalH;

        // 중앙에서 정사각형 crop
        let sx, sy, sSize;
        if (aspect > 1) {
          // 가로가 더 긴 경우 → 좌우 잘라서 가운데 정사각형
          sSize = originalH;
          sx = (originalW - originalH) / 2;
          sy = 0;
        } else {
          // 세로가 더 긴 경우 → 위아래 잘라서 가운데 정사각형
          sSize = originalW;
          sx = 0;
          sy = (originalH - originalW) / 2;
        }

        ctx.drawImage(
          img,
          sx, sy, sSize, sSize,
          0, 0, size, size
        );

        const dataURL = canvas.toDataURL("image/jpeg", 0.9);
        resolve(dataURL);
      };

      img.onerror = reject;
      img.src = e.target.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

beanImageInput.addEventListener("change", async () => {
  const file = beanImageInput.files[0];
  if (!file) {
    currentImageData = "";
    imagePreviewEl.style.display = "none";
    imagePreviewEl.src = "";
    return;
  }

  try {
    const resizedDataUrl = await resizeImageToSquare(file, 512);
    currentImageData = resizedDataUrl;
    imagePreviewEl.src = resizedDataUrl;
    imagePreviewEl.style.display = "block";
  } catch (err) {
    console.error("이미지 처리 실패:", err);
    alert("이미지 로딩 중 문제가 생겼어요.");
  }
});

/****************************
 * Firebase에 새 노트 저장
 ****************************/
saveButton.addEventListener("click", () => {
  const newId = Date.now().toString();

  const newBean = {
    id: Number(newId),
    name: beanNameInput.value.trim(),
    brand: beanBrandInput.value.trim(),
    roast: roastLevelInput.value,
    acidity: acidityInput.value,
    body: bodyInput.value,
    rating: ratingInput.value,
    flavorNotes: flavorNotesInput.value.trim(),
    myNotes: myNotesInput.value.trim(),
    imageData: currentImageData || "",
    timestamp: new Date().toLocaleString()
  };

  if (!newBean.name) {
    alert("원두 이름은 적어주세요 ☕");
    return;
  }

  if (newBean.rating && (Number(newBean.rating) < 1 || Number(newBean.rating) > 10)) {
    alert("평점은 1~10 사이여야 해요.");
    return;
  }

  // Firebase에 저장 (id를 key로 사용)
  beansRef.child(newId).set(newBean)
    .then(() => {
      resetFormState();
      alert("저장 완료! ✅");
    })
    .catch((err) => {
      console.error(err);
      alert("저장 중 문제가 발생했어요.");
    });
});

/****************************
 * 수정 모드 진입
 ****************************/
function startEdit(idNumber) {
  const target = beansData.find((b) => b.id === idNumber);
  if (!target) {
    alert("항목을 찾을 수 없어요.");
    return;
  }

  editTargetId = idNumber;

  beanNameInput.value = target.name || "";
  beanBrandInput.value = target.brand || "";
  roastLevelInput.value = target.roast || "";
  acidityInput.value = target.acidity || "";
  bodyInput.value = target.body || "";
  ratingInput.value = target.rating || "";
  flavorNotesInput.value = target.flavorNotes || "";
  myNotesInput.value = target.myNotes || "";

  currentImageData = target.imageData || "";
  if (currentImageData) {
    imagePreviewEl.src = currentImageData;
    imagePreviewEl.style.display = "block";
  } else {
    imagePreviewEl.src = "";
    imagePreviewEl.style.display = "none";
  }

  beanImageInput.value = "";

  saveButton.style.display = "none";
  updateButton.style.display = "block";

  // 수정은 기록하기 탭에서 하므로 자동 전환
  showWritePage();
}

/****************************
 * 수정 완료 (Firebase 업데이트)
 ****************************/
updateButton.addEventListener("click", () => {
  if (!editTargetId) {
    alert("지금은 수정 모드가 아니에요.");
    return;
  }

  const editedRating = ratingInput.value;
  if (editedRating && (Number(editedRating) < 1 || Number(editedRating) > 10)) {
    alert("평점은 1~10 사이여야 해요.");
    return;
  }

  // 수정 대상 bean의 id를 문자열 키로 쓸 것
  const key = editTargetId.toString();

  const updatedBean = {
    id: editTargetId,
    name: beanNameInput.value.trim(),
    brand: beanBrandInput.value.trim(),
    roast: roastLevelInput.value,
    acidity: acidityInput.value,
    body: bodyInput.value,
    rating: ratingInput.value,
    flavorNotes: flavorNotesInput.value.trim(),
    myNotes: myNotesInput.value.trim(),
    imageData: currentImageData // 새 이미지 또는 기존 이미지 유지
    // timestamp는 원래 기록 시간 유지해야 하므로 기존 것 유지해야 하는데,
    // 여기서는 DB에서 가져와서 덮어쓰는 전략 필요 -> 먼저 원래 timestamp를 가져와서 넣자
  };

  // 기존 timestamp 유지하려면 beansData에서 찾아온 후 덮어준다
  const oldBean = beansData.find(b => b.id === editTargetId);
  if (oldBean && oldBean.timestamp) {
    updatedBean.timestamp = oldBean.timestamp;
  } else {
    updatedBean.timestamp = new Date().toLocaleString();
  }

  beansRef.child(key).set(updatedBean)
    .then(() => {
      resetFormState();
      alert("수정 완료! ✏️");
    })
    .catch((err) => {
      console.error(err);
      alert("수정 중 문제가 발생했어요.");
    });
});

/****************************
 * 삭제 (Firebase에서 제거)
 ****************************/
function deleteBean(idNumber) {
  const ok = confirm("정말 삭제할까요?");
  if (!ok) return;

  const key = idNumber.toString();
  beansRef.child(key).remove()
    .then(() => {
      if (editTargetId === idNumber) {
        resetFormState();
      }
    })
    .catch((err) => {
      console.error(err);
      alert("삭제 중 문제가 발생했어요.");
    });
}

/****************************
 * 폼 초기화
 ****************************/
function resetFormState() {
  editTargetId = null;
  beanNameInput.value = "";
  beanBrandInput.value = "";
  roastLevelInput.value = "";
  acidityInput.value = "";
  bodyInput.value = "";
  ratingInput.value = "";
  flavorNotesInput.value = "";
  myNotesInput.value = "";

  beanImageInput.value = "";
  currentImageData = "";
  imagePreviewEl.src = "";
  imagePreviewEl.style.display = "none";

  saveButton.style.display = "block";
  updateButton.style.display = "none";
}

/****************************
 * 리스트 렌더링 (필터된 결과)
 ****************************/
function renderFilteredList(list) {
  filteredList.innerHTML = "";

  const reversed = [...list].sort((a, b) => a.id - b.id).reverse();
  // sort해서 뒤집는 이유: 최신(큰 id)이 위로

  reversed.forEach((bean) => {
    const card = document.createElement("div");
    card.className = "bean-card";

    const imageSection = bean.imageData
      ? `
        <div class="bean-image-wrapper">
          <img src="${bean.imageData}" alt="bean image"/>
        </div>`
      : "";

    const brandLine = bean.brand
      ? `<div class="bean-brand">${escapeHTML(bean.brand)}</div>`
      : "";

    const ratingBadge = bean.rating
      ? `<div class="bean-rating-display">⭐ ${escapeHTML(bean.rating)}/10</div>`
      : `<div class="bean-rating-display" style="opacity:.4;">⭐ -/10</div>`;

    card.innerHTML = `
      <div class="bean-header">
        <div>
          <div class="bean-name">${escapeHTML(bean.name || "(이름 없음)")}</div>
          ${brandLine}
          <div class="roast-pill">${escapeHTML(bean.roast || "??")}</div>
        </div>

        <div class="bean-actions">
          ${ratingBadge}
          <div class="actions-row">
            <button class="edit-btn" data-id="${bean.id}">수정</button>
            <button class="delete-btn" data-id="${bean.id}">삭제</button>
          </div>
        </div>
      </div>

      ${imageSection}

      <div class="bean-details">
        산미: ${bean.acidity || "-"} / 바디: ${bean.body || "-"}<br/>
        향/노트: ${escapeHTML(bean.flavorNotes || "")}
      </div>

      <div class="bean-notes-title">내 메모</div>
      <div class="bean-details">
        ${escapeHTML(bean.myNotes || "")}
      </div>

      <div class="bean-details" style="font-size:.7rem; opacity:0.6; margin-top:8px;">
        기록일시: ${bean.timestamp || ""}
      </div>
    `;

    filteredList.appendChild(card);
  });

  // 버튼 이벤트 연결
  filteredList.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idToDelete = Number(btn.getAttribute("data-id"));
      deleteBean(idToDelete);
    });
  });

  filteredList.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idToEdit = Number(btn.getAttribute("data-id"));
      startEdit(idToEdit);
    });
  });
}

/****************************
 * 필터 적용
 ****************************/
function applyFilter() {
  const brandQuery = filterBrandInput.value.trim().toLowerCase();
  const acidityQuery = filterAcidityInput.value.trim();
  const bodyQuery = filterBodyInput.value.trim();

  const result = beansData.filter((bean) => {
    // 브랜드 부분검색
    if (brandQuery) {
      const b = (bean.brand || "").toLowerCase();
      if (!b.includes(brandQuery)) return false;
    }

    // 산미 정확 매칭
    if (acidityQuery) {
      if ((bean.acidity || "") !== acidityQuery) return false;
    }

    // 바디 정확 매칭
    if (bodyQuery) {
      if ( (bean.body || "") !== bodyQuery ) return false;
    }

    return true;
  });

  renderFilteredList(result);
}

applyFilterButton.addEventListener("click", applyFilter);

clearFilterButton.addEventListener("click", () => {
  filterBrandInput.value = "";
  filterAcidityInput.value = "";
  filterBodyInput.value = "";
  applyFilter();
});

/****************************
 * 백업 / 복원 / 이메일 전송
 * - 백업: beansData를 JSON으로 다운로드
 * - 복원: JSON을 읽어 Firebase에 밀어넣기
 * - 이메일: mailto 링크로 백업 JSON URL 본문에 추가
 ****************************/
function exportBackup() {
  if (!beansData.length) {
    alert("백업할 데이터가 없습니다.");
    return;
  }

  const json = JSON.stringify(beansData, null, 2);
  const blob = new Blob([json], { type: "application/json" });

  const filename = `coffee_backup_${new Date().toISOString().slice(0, 10)}.json`;
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  alert("백업 파일이 다운로드되었습니다 ☕");
}

function importBackup(file) {
  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const importedData = JSON.parse(e.target.result);
      if (!Array.isArray(importedData)) {
        throw new Error("올바른 백업 파일이 아닙니다.");
      }

      const overwrite = confirm("기존 Firebase 데이터를 전부 이 백업으로 덮어쓸까요? (취소하면 병합)");
      if (overwrite) {
        // 전체를 새로 세팅: 현재 모든 beansRef 지우고 업로드
        beansRef.set(null).then(() => {
          const updates = {};
          importedData.forEach(item => {
            const key = (item.id || Date.now()).toString();
            updates[key] = {
              ...item,
              id: Number(key)
            };
          });
          beansRef.update(updates).then(() => {
            alert("복원(덮어쓰기) 완료 ✅");
          });
        });
      } else {
        // 병합: 기존 id와 겹치지 않는 것만 추가
        const existingIds = new Set(beansData.map(b => b.id));
        const updates = {};
        importedData.forEach(item => {
          if (!existingIds.has(item.id)) {
            const key = (item.id || Date.now()).toString();
            updates[key] = {
              ...item,
              id: Number(key)
            };
          }
        });
        if (Object.keys(updates).length === 0) {
          alert("추가할 새로운 항목이 없습니다.");
        } else {
          beansRef.update(updates).then(() => {
            alert("복원(병합) 완료 ✅");
          });
        }
      }
    } catch (err) {
      console.error(err);
      alert("복원 중 오류가 발생했습니다.");
    }
  };

  reader.readAsText(file);
}

exportButton.addEventListener("click", exportBackup);

importButton.addEventListener("click", () => importFileInput.click());

importFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) importBackup(file);
});

/**
 * 이메일로 백업 보내기:
 * - mailto로 메일 앱을 열고 백업 데이터의 임시 URL을 본문에 넣는다.
 *   (첨부 자동 전송은 브라우저만으로는 불가)
 */
function emailBackup() {
  if (!beansData.length) {
    alert("백업할 데이터가 없습니다.");
    return;
  }

  const subject = encodeURIComponent("Terry’s 커피빈 노트 백업 데이터 (Firebase 버전)");
  const bodyIntro =
    "이 메일은 커피 빈 노트 전체 백업입니다 ☕\n" +
    "아래 링크는 이 브라우저에서 임시로 접근 가능한 JSON Blob URL입니다.\n\n" +
    "백업 시각: " + new Date().toLocaleString() + "\n\n";

  const json = JSON.stringify(beansData, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const bodyFull = encodeURIComponent(bodyIntro + "백업 데이터 URL: " + url);

  window.location.href = `mailto:?subject=${subject}&body=${bodyFull}`;

  alert("메일 앱이 열리지 않으면, '백업 내보내기' 후 파일을 직접 첨부해 주세요.");
}

emailBackupButton.addEventListener("click", emailBackup);

/****************************
 * HTML 출력 시 문자 이스케이프 (XSS 방지)
 ****************************/
function escapeHTML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
