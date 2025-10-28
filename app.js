/****************************
 * 공유형 Firebase 버전 (디버그 로그 강화)
 ****************************/

/****************************
 * 🔒 잠금 / 접근 제어
 ****************************/
const MASTER_PASSWORD = "9494";

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

  applyFilter(); // 최신 beansData 기준 다시 그림
}

tabWriteBtn.addEventListener("click", showWritePage);
tabListBtn.addEventListener("click", showListPage);

/****************************
 * ☕ 커피 노트 데이터 & 폼
 ****************************/
let beansData = [];        // Firebase에서 받아온 최신 상태
let editTargetId = null;   // 현재 수정 중인 bean id
let currentImageData = ""; // base64 이미지

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
let beansRef;
try {
  beansRef = firebase.database().ref("beans");
} catch (e) {
  console.error("firebase 초기화가 안 된 것 같아요. index.html의 firebaseConfig를 확인하세요.", e);
}

/****************************
 * 초기화
 ****************************/
init();
function init() {
  if (!beansRef) {
    console.error("beansRef 없음 - Firebase 설정 미완성");
    alert("Firebase 연결이 아직 준비되지 않았어요. index.html의 firebaseConfig 값을 확인해 주세요.");
    return;
  }

  // Firebase에서 실시간 구독
  beansRef.on("value", (snapshot) => {
    const dataObj = snapshot.val() || {};
    beansData = Object.keys(dataObj).map((key) => dataObj[key]);

    // 로컬 백업 용도로만 저장
    localStorage.setItem("myCoffeeBeans_backup", JSON.stringify(beansData));

    // 현재 페이지가 리스트면 즉시 갱신
    applyFilter();
  }, (err) => {
    console.error("Firebase에서 데이터 읽기 실패:", err);
    alert("데이터 불러올 수 없음 (DB 권한 또는 URL 문제일 수 있어요).");
  });

  resetFormState();
  showWritePage();
}

/****************************
 * 이미지 512x512 정사각 리사이즈
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

        let sx, sy, sSize;
        if (aspect > 1) {
          sSize = originalH;
          sx = (originalW - originalH) / 2;
          sy = 0;
        } else {
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
 * 새 노트 저장 (Firebase .set)
 ****************************/
saveButton.addEventListener("click", () => {
  if (!beansRef) {
    alert("Firebase가 아직 준비되지 않았어요 (beansRef 없음).");
    return;
  }

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

  console.log("저장 시도:", newBean);

  beansRef.child(newId).set(newBean)
    .then(() => {
      console.log("저장 성공");
      resetFormState();
      alert("저장 완료! ✅");
    })
    .catch((err) => {
      console.error("저장 실패:", err);
      alert("저장 중 문제가 발생했어요.\n(콘솔 에러 메시지를 확인해 주세요)");
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

  showWritePage();
}

/****************************
 * 수정 완료 (.set으로 덮어쓰기)
 ****************************/
updateButton.addEventListener("click", () => {
  if (!beansRef) {
    alert("Firebase가 아직 준비되지 않았어요 (beansRef 없음).");
    return;
  }
  if (!editTargetId) {
    alert("지금은 수정 모드가 아니에요.");
    return;
  }

  const editedRating = ratingInput.value;
  if (editedRating && (Number(editedRating) < 1 || Number(editedRating) > 10)) {
    alert("평점은 1~10 사이여야 해요.");
    return;
  }

  const key = editTargetId.toString();
  const oldBean = beansData.find(b => b.id === editTargetId);

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
    imageData: currentImageData,
    timestamp: oldBean && oldBean.timestamp ? oldBean.timestamp : new Date().toLocaleString()
  };

  console.log("수정 시도:", updatedBean);

  beansRef.child(key).set(updatedBean)
    .then(() => {
      console.log("수정 성공");
      resetFormState();
      alert("수정 완료! ✏️");
    })
    .catch((err) => {
      console.error("수정 실패:", err);
      alert("수정 중 문제가 발생했어요.\n(콘솔 에러 메시지를 확인해 주세요)");
    });
});

/****************************
 * 삭제
 ****************************/
function deleteBean(idNumber) {
  if (!beansRef) {
    alert("Firebase가 아직 준비되지 않았어요 (beansRef 없음).");
    return;
  }

  const ok = confirm("정말 삭제할까요?");
  if (!ok) return;

  const key = idNumber.toString();
  console.log("삭제 시도 id:", key);

  beansRef.child(key).remove()
    .then(() => {
      console.log("삭제 성공");
      if (editTargetId === idNumber) {
        resetFormState();
      }
    })
    .catch((err) => {
      console.error("삭제 실패:", err);
      alert("삭제 중 문제가 발생했어요.\n(콘솔 에러 메시지를 확인해 주세요)");
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
 * 리스트 렌더링
 ****************************/
function renderFilteredList(list) {
  filteredList.innerHTML = "";

  // 최신 id(=최근 저장)가 위로 오게 정렬
  const reversed = [...list].sort((a, b) => a.id - b.id).reverse();

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
    if (brandQuery) {
      const b = (bean.brand || "").toLowerCase();
      if (!b.includes(brandQuery)) return false;
    }

    if (acidityQuery) {
      if ((bean.acidity || "") !== acidityQuery) return false;
    }

    if (bodyQuery) {
      if ((bean.body || "") !== bodyQuery) return false;
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
  if (!beansRef) {
    alert("Firebase가 아직 준비되지 않았어요 (beansRef 없음).");
    return;
  }

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const importedData = JSON.parse(e.target.result);
      if (!Array.isArray(importedData)) {
        throw new Error("올바른 백업 파일이 아닙니다.");
      }

      const overwrite = confirm("기존 Firebase 데이터를 전부 이 백업으로 덮어쓸까요? (취소하면 병합)");

      if (overwrite) {
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
      console.error("복원 실패:", err);
      alert("복원 중 오류가 발생했습니다. 콘솔 에러를 확인해 주세요.");
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
 * XSS 방지용 이스케이프
 ****************************/
function escapeHTML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
