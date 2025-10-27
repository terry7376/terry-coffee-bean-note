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

  // 리스트 페이지 열릴 때마다 최신 데이터로 필터 적용
  applyFilter();
}

tabWriteBtn.addEventListener("click", showWritePage);
tabListBtn.addEventListener("click", showListPage);

/****************************
 * ☕ 커피 노트 데이터 & 폼
 ****************************/
let beansData = [];        // 모든 저장된 노트들
let editTargetId = null;   // 현재 수정 중인 노트 id (없으면 null)
let currentImageData = ""; // 현재 선택된 이미지 (base64)

const beanNameInput = document.getElementById("beanName");
const beanBrandInput = document.getElementById("beanBrand");
const roastLevelInput = document.getElementById("roastLevel");
const acidityInput = document.getElementById("acidity");
const bodyInput = document.getElementById("body");
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
 * 초기화
 ****************************/
init();

function init() {
  const saved = localStorage.getItem("myCoffeeBeans");
  beansData = saved ? JSON.parse(saved) : [];
  resetFormState();
  showWritePage(); // 앱 처음 열면 "기록하기" 탭
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
 * 새 노트 저장
 ****************************/
saveButton.addEventListener("click", () => {
  const newBean = {
    id: Date.now(),
    name: beanNameInput.value.trim(),
    brand: beanBrandInput.value.trim(),
    roast: roastLevelInput.value,
    acidity: acidityInput.value,
    body: bodyInput.value,
    flavorNotes: flavorNotesInput.value.trim(),
    myNotes: myNotesInput.value.trim(),
    imageData: currentImageData || "",
    timestamp: new Date().toLocaleString()
  };

  if (!newBean.name) {
    alert("원두 이름은 적어주세요 ☕");
    return;
  }

  beansData.push(newBean);
  localStorage.setItem("myCoffeeBeans", JSON.stringify(beansData));

  resetFormState();
  alert("저장 완료! ✅");
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

  // 파일 input은 보안상 직접 값 못 넣으므로 비워둠
  beanImageInput.value = "";

  saveButton.style.display = "none";
  updateButton.style.display = "block";

  // 수정은 기록하기 탭에서만 하니까 자동으로 탭 전환
  showWritePage();
}

/****************************
 * 수정 완료
 ****************************/
updateButton.addEventListener("click", () => {
  if (!editTargetId) {
    alert("지금은 수정 모드가 아니에요.");
    return;
  }

  beansData = beansData.map((bean) => {
    if (bean.id === editTargetId) {
      return {
        ...bean,
        name: beanNameInput.value.trim(),
        brand: beanBrandInput.value.trim(),
        roast: roastLevelInput.value,
        acidity: acidityInput.value,
        body: bodyInput.value,
        flavorNotes: flavorNotesInput.value.trim(),
        myNotes: myNotesInput.value.trim(),
        imageData: currentImageData // 새 이미지 또는 기존 이미지
        // timestamp는 최초 기록 시간 유지
      };
    }
    return bean;
  });

  localStorage.setItem("myCoffeeBeans", JSON.stringify(beansData));

  resetFormState();
  alert("수정 완료! ✏️");
  // 여기서 showListPage()를 자동으로 호출해서 결과 확인하게 할 수도 있음.
});

/****************************
 * 삭제
 ****************************/
function deleteBean(idNumber) {
  const ok = confirm("정말 삭제할까요?");
  if (!ok) return;

  beansData = beansData.filter((bean) => bean.id !== idNumber);
  localStorage.setItem("myCoffeeBeans", JSON.stringify(beansData));

  // 삭제 후 리스트 갱신
  applyFilter();

  // 만약 지금 수정 중이던 걸 삭제했으면 폼 초기화
  if (editTargetId === idNumber) {
    resetFormState();
  }
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

  const reversed = [...list].reverse(); // 최신 항목이 위

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

    card.innerHTML = `
      <div class="bean-header">
        <div>
          <div class="bean-name">${escapeHTML(bean.name || "(이름 없음)")}</div>
          ${brandLine}
          <div class="roast-pill">${escapeHTML(bean.roast || "??")}</div>
        </div>

        <div class="bean-actions">
          <button class="edit-btn" data-id="${bean.id}">수정</button>
          <button class="delete-btn" data-id="${bean.id}">삭제</button>
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
        기록일시: ${bean.timestamp}
      </div>
    `;

    filteredList.appendChild(card);
  });

  // 각 카드 안의 수정/삭제 버튼에 이벤트 연결
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idToDelete = btn.getAttribute("data-id");
      deleteBean(Number(idToDelete));
    });
  });

  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idToEdit = btn.getAttribute("data-id");
      startEdit(Number(idToEdit));
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
    // 브랜드 부분검색 (소문자로 비교)
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
    alert("저장된 원두 기록이 없습니다.");
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

      const overwrite = confirm("기존 데이터 위에 덮어쓸까요? (취소하면 병합)");
      if (overwrite) {
        // 완전 덮어쓰기
        beansData = importedData;
      } else {
        // 병합 (id 기준으로 없는 것만 추가)
        const existingIds = new Set(beansData.map(b => b.id));
        importedData.forEach(item => {
          if (!existingIds.has(item.id)) {
            beansData.push(item);
          }
        });
      }

      localStorage.setItem("myCoffeeBeans", JSON.stringify(beansData));
      alert("복원이 완료되었습니다 ✅");
      applyFilter();
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
 * - 브라우저에서 직접 메일 첨부 전송은 제한됨
 * - 대신 mailto로 메일 앱을 열고, 백업 데이터 링크를 본문에 넣어준다
 */
function emailBackup() {
  if (!beansData.length) {
    alert("백업할 데이터가 없습니다.");
    return;
  }

  const subject = encodeURIComponent("Terry’s 커피빈 노트 백업 데이터");
  const bodyIntro = 
    "첨부된 JSON 백업을 보관해 주세요 ☕\n" +
    "이 링크는 현재 브라우저에서 임시로 열 수 있는 백업 데이터입니다.\n\n" +
    "백업 날짜: " + new Date().toLocaleString() + "\n\n";

  // JSON 문자열 만들고 Blob으로 URL 만들기
  const json = JSON.stringify(beansData, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const bodyFull = encodeURIComponent(bodyIntro + "백업 파일(복사하여 저장): " + url);

  // 기본 메일 앱 열기
  window.location.href = `mailto:?subject=${subject}&body=${bodyFull}`;

  alert("메일 앱이 열리지 않으면, 백업 내보내기를 먼저 눌러서 파일을 직접 첨부해 주세요.");
}

emailBackupButton.addEventListener("click", emailBackup);

/****************************
 * HTML 출력 시 문자 이스케이프 (XSS 방지)
 ****************************/
function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
