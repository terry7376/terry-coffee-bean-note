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
 * ☕ 커피 노트 앱 로직
 ****************************/
let beansData = [];
let editTargetId = null;

const beanNameInput = document.getElementById("beanName");
const roastLevelInput = document.getElementById("roastLevel");
const acidityInput = document.getElementById("acidity");
const bodyInput = document.getElementById("body");
const flavorNotesInput = document.getElementById("flavorNotes");
const myNotesInput = document.getElementById("myNotes");
const saveButton = document.getElementById("saveButton");
const updateButton = document.getElementById("updateButton");
const beansList = document.getElementById("beansList");

init();

function init() {
  const saved = localStorage.getItem("myCoffeeBeans");
  beansData = saved ? JSON.parse(saved) : [];
  renderList();
  resetFormState();
}

function renderList() {
  beansList.innerHTML = "";
  const reversed = [...beansData].reverse();

  reversed.forEach((bean) => {
    const card = document.createElement("div");
    card.className = "bean-card";
    card.innerHTML = `
      <div class="bean-header">
        <div>
          <div class="bean-name">${escapeHTML(bean.name || "(이름 없음)")}</div>
          <div class="roast-pill">${escapeHTML(bean.roast || "??")}</div>
        </div>
        <div class="bean-actions">
          <button class="edit-btn" data-id="${bean.id}">수정</button>
          <button class="delete-btn" data-id="${bean.id}">삭제</button>
        </div>
      </div>
      <div class="bean-details">
        산미: ${bean.acidity || "-"} / 바디: ${bean.body || "-"}<br/>
        향/노트: ${escapeHTML(bean.flavorNotes || "")}
      </div>
      <div class="bean-notes-title">내 메모</div>
      <div class="bean-details">${escapeHTML(bean.myNotes || "")}</div>
      <div class="bean-details" style="font-size:.7rem;opacity:0.6;margin-top:8px;">
        기록일시: ${bean.timestamp}
      </div>`;
    beansList.appendChild(card);
  });

  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => deleteBean(Number(btn.dataset.id)));
  });
  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", () => startEdit(Number(btn.dataset.id)));
  });
}

function deleteBean(idNumber) {
  if (!confirm("정말 삭제할까요?")) return;
  beansData = beansData.filter(b => b.id !== idNumber);
  localStorage.setItem("myCoffeeBeans", JSON.stringify(beansData));
  renderList();
  if (editTargetId === idNumber) resetFormState();
}

function startEdit(idNumber) {
  const target = beansData.find(b => b.id === idNumber);
  if (!target) return alert("항목을 찾을 수 없어요.");
  beanNameInput.value = target.name;
  roastLevelInput.value = target.roast;
  acidityInput.value = target.acidity;
  bodyInput.value = target.body;
  flavorNotesInput.value = target.flavorNotes;
  myNotesInput.value = target.myNotes;
  editTargetId = idNumber;
  saveButton.style.display = "none";
  updateButton.style.display = "block";
}

updateButton.addEventListener("click", () => {
  if (!editTargetId) return;
  beansData = beansData.map(b =>
    b.id === editTargetId ? {
      ...b,
      name: beanNameInput.value.trim(),
      roast: roastLevelInput.value,
      acidity: acidityInput.value,
      body: bodyInput.value,
      flavorNotes: flavorNotesInput.value.trim(),
      myNotes: myNotesInput.value.trim()
    } : b
  );
  localStorage.setItem("myCoffeeBeans", JSON.stringify(beansData));
  renderList();
  resetFormState();
  alert("수정 완료! ✏️");
});

saveButton.addEventListener("click", () => {
  const newBean = {
    id: Date.now(),
    name: beanNameInput.value.trim(),
    roast: roastLevelInput.value,
    acidity: acidityInput.value,
    body: bodyInput.value,
    flavorNotes: flavorNotesInput.value.trim(),
    myNotes: myNotesInput.value.trim(),
    timestamp: new Date().toLocaleString()
  };
  if (!newBean.name) return alert("원두 이름은 적어주세요 ☕");
  beansData.push(newBean);
  localStorage.setItem("myCoffeeBeans", JSON.stringify(beansData));
  renderList();
  resetFormState();
  alert("저장 완료! ✅");
});

function resetFormState() {
  beanNameInput.value = "";
  roastLevelInput.value = "";
  acidityInput.value = "";
  bodyInput.value = "";
  flavorNotesInput.value = "";
  myNotesInput.value = "";
  editTargetId = null;
  saveButton.style.display = "block";
  updateButton.style.display = "none";
}

function escapeHTML(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
