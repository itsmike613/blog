import { posts } from "./posts.js";
import { auth, db, provider, signInWithPopup, onAuthStateChanged, signOut, doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, serverTimestamp } from "./firebase.js";

const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];
const reactions = [
    ["love", "❤️", "I love this"],
    ["like", "👍", "I like this"],
    ["disagree", "👎", "I disagree with this"],
    ["thoughtful", "💭", "This made me think"],
    ["learned", "📙", "I learned something"],
    ["debate", "🔄", "Worth discussing"]
];
let user = null;

function words(html) {
    return html.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
}
function readingTime(post) {
    return Math.max(1, Math.ceil(words(post.content) / 220));
}
function formatDate(value) {
    return new Date(value + "T00:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}
function postCard(post) {
    return `<a class="card" href="read.html?post=${encodeURIComponent(post.id)}">
    <div class="card-title">${post.pinned ? `<i class="ph ph-push-pin-simple" aria-hidden="true"></i>` : ""}<h3>${post.title}</h3></div>
    <p class="muted">${post.description}</p>
    <div class="tags">${post.tags.map(t => `<span class="tag">#${t}</span>`).join("")}</div>
    <div class="meta">
      <span><i class="ph ph-calendar-blank"></i>${formatDate(post.date)}</span>
      <span><i class="ph ph-book-open"></i>${readingTime(post)} min</span>
    </div>
  </a>`;
}
function sortPosts(mode) {
    const copy = posts.filter(p => !p.pinned);
    if (mode === "newest") copy.sort((a, b) => b.date.localeCompare(a.date));
    else if (mode === "oldest") copy.sort((a, b) => a.date.localeCompare(b.date));
    else copy.sort((a, b) => a.recommendedOrder - b.recommendedOrder);
    return copy;
}
function setupTheme() {
    const saved = localStorage.getItem("theme");
    const theme = saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
    updateThemeIcon();
    $("#themeToggle")?.addEventListener("click", () => {
        document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        localStorage.setItem("theme", document.documentElement.dataset.theme);
        updateThemeIcon();
    });
}
function updateThemeIcon() {
    const icon = $("#themeToggle i");
    if (icon) icon.className = `ph ph-${document.documentElement.dataset.theme === "dark" ? "sun" : "moon"}`;
}
function authRedirect() {
    return `auth.html?redirect=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}`;
}
function requireUser() {
    if (user) return true;
    location.href = authRedirect();
    return false;
}
function setupAuthButton() {
    onAuthStateChanged(auth, current => {
        user = current;
        const btn = $("#authButton");
        if (btn) {
            if (user) {
                btn.innerHTML = `<span>${user.displayName || "Account"}</span>`;
                btn.href = "#";
                btn.onclick = async e => {
                    e.preventDefault();
                    await signOut(auth);
                };
            } else {
                btn.innerHTML = `<i class="ph ph-sign-in"></i><span>Login</span>`;
                btn.href = authRedirect();
                btn.onclick = null;
            }
        }
        if ($("#commentsPanel")) loadComments();
        if ($("#reactionPanel")) loadReactions();
        updateCommentState();
    });
}
function renderHome() {
    const pinned = posts.filter(p => p.pinned).sort((a, b) => a.recommendedOrder - b.recommendedOrder);
    $("#pinnedPosts").innerHTML = pinned.map(postCard).join("");
    const render = mode => $("#postGrid").innerHTML = sortPosts(mode).map(postCard).join("");
    render("recommended");
    $$(".sort").forEach(btn => btn.addEventListener("click", () => {
        $$(".sort").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        render(btn.dataset.sort);
    }));
}
function currentPost() {
    const id = new URLSearchParams(location.search).get("post");
    return posts.find(p => p.id === id) || posts[0];
}
function renderRead() {
    const post = currentPost();
    document.title = `${post.title} | My Blog`;
    setMeta("description", post.description);
    setMeta("og:title", post.title, true);
    setMeta("og:description", post.description, true);
    $("#article").innerHTML = `<header>
    <h1>${post.title}</h1>
    <p class="muted">${post.description}</p>
    <div class="tags">${post.tags.map(t => `<span class="tag">#${t}</span>`).join("")}</div>
    <div class="meta">
      <span><i class="ph ph-calendar-blank"></i>${formatDate(post.date)}</span>
      <span><i class="ph ph-book-open"></i>${readingTime(post)} min</span>
    </div>
  </header>
  <div class="article-body">${post.content}</div>`;
}
function setMeta(name, content, property = false) {
    const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
    const meta = $(selector);
    if (meta) meta.content = content;
}
function loadReactions() {
    const post = currentPost();
    onSnapshot(collection(db, "posts", post.id, "reactions"), snap => {
        const totals = Object.fromEntries(reactions.map(r => [r[0], 0]));
        const mine = user ? snap.docs.find(d => d.id === user.uid)?.data() || {} : {};
        snap.docs.forEach(d => reactions.forEach(([key]) => { if (d.data()[key]) totals[key]++; }));
        $("#reactions").innerHTML = reactions.map(([key, emoji, tip]) =>
            `<button class="reaction ${mine[key] ? "active" : ""}" data-key="${key}" data-tip="${tip}" type="button" aria-label="${tip}">${emoji} ${totals[key]}</button>`
        ).join("");
        $$(".reaction").forEach(btn => btn.addEventListener("click", async () => {
            if (!requireUser()) return;
            const ref = doc(db, "posts", post.id, "reactions", user.uid);
            const old = (await getDoc(ref)).data() || {};
            await setDoc(ref, { ...old, [btn.dataset.key]: !old[btn.dataset.key] });
        }));
    });
}
function updateCommentState() {
    const form = $("#commentForm");
    if (!form) return;
    $("#commentText").disabled = !user;
    $("button[type='submit']", form).disabled = !user;
    $("#commentHelp").textContent = user ? "One comment per post. Delete it to post again." : "Sign in to comment.";
}
function loadComments() {
    const post = currentPost();
    onSnapshot(collection(db, "posts", post.id, "comments"), snap => {
        const comments = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        $("#comments").innerHTML = comments.map(commentHtml).join("") || `<p class="muted">No comments yet.</p>`;
        comments.forEach(c => loadVotes(post.id, c.id));
        $$(".delete-btn").forEach(btn => btn.addEventListener("click", async () => {
            if (user && btn.dataset.uid === user.uid) await deleteDoc(doc(db, "posts", post.id, "comments", user.uid));
        }));
        $$(".vote").forEach(btn => btn.addEventListener("click", async () => {
            if (!requireUser()) return;
            const ref = doc(db, "posts", post.id, "comments", btn.dataset.comment, "votes", user.uid);
            const old = (await getDoc(ref)).data();
            if (old?.type === btn.dataset.type) await deleteDoc(ref);
            else await setDoc(ref, { uid: user.uid, type: btn.dataset.type });
        }));
    });
}
function commentHtml(c) {
    const mine = user && c.uid === user.uid;
    const avatar = c.photoURL ? `<img class="avatar" src="${c.photoURL}" alt="">` : `<span class="avatar">${initials(c.name)}</span>`;
    const date = c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000).toLocaleDateString() : "";
    return `<div class="comment">
    <div class="comment-head">
      <div class="person">${avatar}<div><div class="name">${escapeHtml(c.name || "Reader")}</div><div class="date">${date}</div></div></div>
      ${mine ? `<button class="delete-btn" data-uid="${c.uid}" type="button"><i class="ph ph-trash"></i>Delete</button>` : ""}
    </div>
    <p>${escapeHtml(c.text || "")}</p>
    <div class="vote-row" id="votes-${c.id}">
      <button class="vote" data-comment="${c.id}" data-type="like" type="button">👍 0</button>
      <button class="vote" data-comment="${c.id}" data-type="dislike" type="button">👎 0</button>
    </div>
  </div>`;
}
function loadVotes(postId, commentId) {
    onSnapshot(collection(db, "posts", postId, "comments", commentId, "votes"), snap => {
        const counts = { like: 0, dislike: 0 };
        let mine = "";
        snap.docs.forEach(d => {
            const v = d.data();
            if (v.type) counts[v.type]++;
            if (user && d.id === user.uid) mine = v.type;
        });
        const row = $(`#votes-${CSS.escape(commentId)}`);
        if (!row) return;
        row.innerHTML = ["like", "dislike"].map(type =>
            `<button class="vote ${mine === type ? "active" : ""}" data-comment="${commentId}" data-type="${type}" type="button">${type === "like" ? "👍" : "👎"} ${counts[type]}</button>`
        ).join("");
        $$(".vote", row).forEach(btn => btn.addEventListener("click", async () => {
            if (!requireUser()) return;
            const ref = doc(db, "posts", postId, "comments", commentId, "votes", user.uid);
            const old = (await getDoc(ref)).data();
            if (old?.type === btn.dataset.type) await deleteDoc(ref);
            else await setDoc(ref, { uid: user.uid, type: btn.dataset.type });
        }));
    });
}
function setupCommentForm() {
    $("#commentForm")?.addEventListener("submit", async e => {
        e.preventDefault();
        if (!requireUser()) return;
        const text = $("#commentText").value.trim();
        if (!text) return;
        const post = currentPost();
        await setDoc(doc(db, "posts", post.id, "comments", user.uid), {
            uid: user.uid,
            name: user.displayName || "Reader",
            photoURL: user.photoURL || "",
            text,
            createdAt: serverTimestamp()
        });
        $("#commentText").value = "";
    });
}
function setupAuthPage() {
    const params = new URLSearchParams(location.search);
    const redirect = params.get("redirect") || "index.html";
    $("#backLink").href = redirect;
    $("#googleSignIn").addEventListener("click", async () => {
        await signInWithPopup(auth, provider);
        location.href = redirect;
    });
}
function initials(name = "Reader") {
    return name.split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase();
}
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

setupTheme();
setupAuthButton();
if ($("#postGrid")) renderHome();
if ($("#article")) {
    renderRead();
    setupCommentForm();
}
if ($("#googleSignIn")) setupAuthPage();
