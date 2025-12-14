// Advanced gallery JS — All features added (15 total).
// Replaces previous script.js. No external libraries required except JSZip (loaded dynamically only when needed).

/* STORAGE KEYS */
const STORAGE_KEY = 'adv_gallery_images_v2';
const FAV_KEY = 'adv_gallery_favs_v2';
const THEME_KEY = 'adv_gallery_theme_v2';
const TRASH_KEY = 'adv_gallery_trash_v2';
const ALBUM_KEY = 'adv_gallery_albums_v2';

/* DEFAULT IMAGES */
const defaults = [
  { id: 'i1', title: 'Sunset over hills', src: 'https://picsum.photos/id/1018/800/600', category: 'nature', tags: ['sunset','hills'], uploadedAt: Date.now()-10000000 },
  { id: 'i2', title: 'Forest path', src: 'https://picsum.photos/id/1020/800/1000', category: 'nature', tags: ['forest','path'], uploadedAt: Date.now()-9000000 },
  { id: 'i3', title: 'Modern building', src: 'https://picsum.photos/id/1011/800/900', category: 'architecture', tags: ['building','modern'], uploadedAt: Date.now()-8000000 },
  { id: 'i4', title: 'City skyline', src: 'https://picsum.photos/id/1016/1200/700', category: 'architecture', tags: ['city','skyline'], uploadedAt: Date.now()-7000000 },
  { id: 'i5', title: 'Portrait smile', src: 'https://picsum.photos/id/1005/900/900', category: 'people', tags: ['portrait','smile'], uploadedAt: Date.now()-6000000 }
];

/* APP STATE */
let images = loadImages();
let favs = loadFavs();
let trash = loadTrash();
let albums = loadAlbums();
let filtered = [...images];
let currentTab = 'all';
let currentIndex = 0;
let slideshowTimer = null;
let autoplayMs = +(document.getElementById('autoplayInterval')?.value || 0);
let isPlaying = false;
let isKeyboardMode = false;
let galleryFilters = {category: 'all', q:'', album:'all', tags:[], cssFilters: {grayscale:0, blur:0, contrast:100}};
let renderChunk = 8; // items to render per chunk for infinite scroll
let renderedCount = 0;

/* DOM HELPERS */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

/* DOM ELEMENTS (expected from HTML) */
const gallery = document.getElementById('gallery');
const countEl = document.getElementById('count');
const searchInput = document.getElementById('search');
const categoryFilter = document.getElementById('categoryFilter');
const sortSelect = document.getElementById('sort');
const tabButtons = document.querySelectorAll('.tab-btn');
const themeToggle = document.getElementById('themeToggle');
const slideshowToggle = document.getElementById('slideshowToggle');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const uploadOpenBtn = document.getElementById('uploadOpenBtn');
const autoplaySelect = document.getElementById('autoplayInterval');

/* Lightbox elements (may be in HTML) — if missing, created later */
let lb, lbImg, lbTitle, lbCategory, lbPrev, lbNext, lbPlay, lbClose, lbFav, lbDownload, lbZoom;

/* Upload modal elements */
let uploadModal, uploadForm, uploadFile, uploadTitle, uploadCategory, uploadTags, uploadAlbum, uploadCancel;

/* Trash / Albums / Filters UI created dynamically */
let trashModal, albumsPanel, filtersPanel;

/* INITIALIZATION */
initUI();            // ensure required UI exists
renderGallery(true); // initial render (true resets chunk)
updateCount();
bindUI();
applyTheme(loadTheme());

/* ------------------ Storage helpers ------------------ */
function loadImages(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw){ localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults)); return JSON.parse(JSON.stringify(defaults)); }
    return JSON.parse(raw);
  } catch(e){ console.error('loadImages', e); return JSON.parse(JSON.stringify(defaults)); }
}
function saveImages(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(images)); }

function loadFavs(){ try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch(e){ return []; } }
function saveFavs(){ localStorage.setItem(FAV_KEY, JSON.stringify(favs)); }

function loadTrash(){ try { return JSON.parse(localStorage.getItem(TRASH_KEY) || '[]'); } catch(e){ return []; } }
function saveTrash(){ localStorage.setItem(TRASH_KEY, JSON.stringify(trash)); }

function loadAlbums(){ try { return JSON.parse(localStorage.getItem(ALBUM_KEY) || '{"__default": "All"}'); } catch(e){ return {"__default":"All"} } }
function saveAlbums(){ localStorage.setItem(ALBUM_KEY, JSON.stringify(albums)); }

function loadTheme(){ return localStorage.getItem(THEME_KEY) || 'dark'; }
function saveTheme(t){ localStorage.setItem(THEME_KEY, t); }

/* ------------------ UI creation ------------------ */
function initUI(){
  // Lightbox: create if missing
  if(!document.getElementById('lightbox')) createLightbox();
  lb = document.getElementById('lightbox');
  lbImg = document.getElementById('lbImage');
  lbTitle = document.getElementById('lbTitle');
  lbCategory = document.getElementById('lbCategory');
  lbPrev = document.getElementById('lbPrev');
  lbNext = document.getElementById('lbNext');
  lbPlay = document.getElementById('lbPlay');
  lbClose = document.getElementById('lbClose');
  lbFav = document.getElementById('lbFav');
  lbDownload = document.getElementById('lbDownload');

  // Add zoom slider to lightbox controls
  if(!document.getElementById('lbZoom')){
    const controls = document.querySelector('.lb-controls') || lb.querySelector('.lb-controls');
    if(controls){
      const zoom = document.createElement('input');
      zoom.type = 'range'; zoom.min = 50; zoom.max = 200; zoom.value = 100; zoom.id = 'lbZoom';
      zoom.title = 'Zoom';
      controls.insertBefore(zoom, controls.firstChild);
    }
  }
  lbZoom = document.getElementById('lbZoom');

  // Upload modal: create if missing
  if(!document.getElementById('uploadModal')) createUploadModal();
  uploadModal = document.getElementById('uploadModal');
  uploadForm = document.getElementById('uploadForm');
  uploadFile = document.getElementById('uploadFile');
  uploadTitle = document.getElementById('uploadTitle');
  uploadCategory = document.getElementById('uploadCategory');
  uploadTags = document.getElementById('uploadTags');
  uploadAlbum = document.getElementById('uploadAlbum');
  uploadCancel = document.getElementById('uploadCancel');

  // Trash modal
  if(!document.getElementById('trashModal')) createTrashModal();
  trashModal = document.getElementById('trashModal');

  // Albums panel
  if(!document.getElementById('albumsPanel')) createAlbumsPanel();
  albumsPanel = document.getElementById('albumsPanel');

  // Filters Panel (CSS filters)
  if(!document.getElementById('filtersPanel')) createFiltersPanel();
  filtersPanel = document.getElementById('filtersPanel');

  // Add extra toolbar buttons if not present
  const rightControls = document.querySelector('.right-controls');
  if(rightControls && !document.getElementById('downloadAllZipBtn')){
    const zipBtn = document.createElement('button'); zipBtn.id = 'downloadAllZipBtn'; zipBtn.textContent = 'Download All (ZIP)';
    rightControls.prepend(zipBtn);
    zipBtn.addEventListener('click', downloadAllAsZip);
    // trash button
    const trashBtn = document.createElement('button'); trashBtn.id = 'openTrashBtn'; trashBtn.textContent = 'Trash 🗑';
    rightControls.prepend(trashBtn);
    trashBtn.addEventListener('click', ()=> openModal(trashModal));
    // keyboard mode toggle
    const kbBtn = document.createElement('button'); kbBtn.id = 'kbModeBtn'; kbBtn.title = 'Toggle keyboard-only navigation (WASD)';
    kbBtn.textContent = 'WASD';
    rightControls.prepend(kbBtn);
    kbBtn.addEventListener('click', ()=> {
      isKeyboardMode = !isKeyboardMode;
      kbBtn.style.background = isKeyboardMode ? 'var(--accent)' : '';
      kbBtn.style.color = isKeyboardMode ? 'black' : '';
      alert('Keyboard-only mode ' + (isKeyboardMode ? 'enabled' : 'disabled') + '. Use W/A/S/D to navigate.');
    });
    // album manager open
    const albumBtn = document.createElement('button'); albumBtn.id = 'openAlbumsBtn'; albumBtn.textContent = 'Albums 🗂';
    rightControls.prepend(albumBtn);
    albumBtn.addEventListener('click', ()=> openModal(albumsPanel));
  }

  // Drag & drop hint area (overlay)
  if(!document.getElementById('dropOverlay')){
    const overlay = document.createElement('div'); overlay.id = 'dropOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:1000;pointer-events:none;';
    overlay.innerHTML = '<div style="pointer-events:auto;background:rgba(6,182,212,0.12);padding:24px;border-radius:12px;border:2px dashed rgba(6,182,212,0.2);color:var(--text);font-size:20px">Drop images to upload</div>';
    document.body.appendChild(overlay);
  }
}

/* ------------------ Create dynamic UI pieces ------------------ */
function createLightbox(){
  const div = document.createElement('div');
  div.id = 'lightbox';
  div.className = 'lightbox';
  div.setAttribute('aria-hidden','true');
  div.innerHTML = `
    <div class="lb-content">
      <button id="lbClose" class="lb-close">✕</button>
      <div class="lb-media"><img id="lbImage" src="" alt=""></div>
      <div class="lb-info">
        <div><strong id="lbTitle"></strong><div id="lbCategory" class="muted"></div></div>
        <div class="lb-controls">
          <!-- zoom slider will be inserted dynamically -->
          <button id="lbPrev">◀</button>
          <button id="lbPlay">▶</button>
          <button id="lbNext">▶</button>
          <button id="lbFav">♡</button>
          <button id="lbDownload">⬇️</button>
          <button id="lbShare">🔗</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(div);
  // after adding, wire lbShare
  setTimeout(()=> {
    const btn = document.getElementById('lbShare');
    if(btn) btn.addEventListener('click', ()=> {
      const item = filtered[currentIndex];
      if(!item) return;
      shareImage(item);
    });
  }, 20);
}

function createUploadModal(){
  const div = document.createElement('div');
  div.id = 'uploadModal'; div.className = 'modal';
  div.innerHTML = `
    <div class="modal-inner">
      <h3>Upload Image</h3>
      <form id="uploadForm">
        <label>Choose image: <input id="uploadFile" type="file" accept="image/*" required></label>
        <label>Title: <input id="uploadTitle" type="text" placeholder="Image title"></label>
        <label>Category:
          <select id="uploadCategory">
            <option value="nature">Nature</option>
            <option value="architecture">Architecture</option>
            <option value="people">People</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>Tags (comma separated): <input id="uploadTags" placeholder="tag1, tag2"></label>
        <label>Album:
          <select id="uploadAlbum"></select>
        </label>
        <div class="modal-actions">
          <button type="submit" class="primary">Upload</button>
          <button type="button" id="uploadCancel">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(div);
  // populate album select when open
}

function createTrashModal(){
  const div = document.createElement('div');
  div.id = 'trashModal'; div.className = 'modal';
  div.innerHTML = `
    <div class="modal-inner">
      <h3>Trash</h3>
      <div id="trashList" style="max-height:300px;overflow:auto"></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
        <button id="emptyTrashBtn" class="primary">Empty Trash</button>
        <button id="closeTrashBtn">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
}

function createAlbumsPanel(){
  const div = document.createElement('div');
  div.id = 'albumsPanel'; div.className = 'modal';
  div.innerHTML = `
    <div class="modal-inner">
      <h3>Albums</h3>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="newAlbumName" placeholder="New album name">
        <button id="createAlbumBtn" class="primary">Create</button>
      </div>
      <div id="albumsList" style="margin-top:12px;max-height:300px;overflow:auto"></div>
      <div style="display:flex;justify-content:flex-end;margin-top:8px;">
        <button id="closeAlbumsBtn">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
}

function createFiltersPanel(){
  const div = document.createElement('div');
  div.id = 'filtersPanel'; div.className = 'modal';
  div.innerHTML = `
    <div class="modal-inner">
      <h3>Image Filters</h3>
      <label>Grayscale: <input id="filterGrayscale" type="range" min="0" max="100" value="0"></label>
      <label>Blur (px): <input id="filterBlur" type="range" min="0" max="10" value="0"></label>
      <label>Contrast (%): <input id="filterContrast" type="range" min="50" max="200" value="100"></label>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
        <button id="applyFiltersBtn" class="primary">Apply</button>
        <button id="closeFiltersBtn">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
}

/* ------------------ Render / Filtering / Infinite scroll ------------------ */
function applyFiltersAndSort(){
  const q = (searchInput?.value || galleryFilters.q || '').trim().toLowerCase();
  const cat = (categoryFilter?.value || galleryFilters.category || 'all');
  const albumSel = galleryFilters.album || 'all';
  const queryTags = galleryFilters.tags || [];

  filtered = images.filter(i=>{
    if(currentTab === 'favorites' && !favs.includes(i.id)) return false;
    if(currentTab === 'uploads' && !(i.isUploaded)) return false;
    if(cat !== 'all' && i.category !== cat) return false;
    if(albumSel !== 'all' && (i.album || '__default') !== albumSel) return false;
    if(q){
      const hay = (i.title + ' ' + i.category + ' ' + (i.tags||[]).join(' ')).toLowerCase();
      if(!hay.includes(q)) return false;
    }
    if(queryTags.length){
      const itags = (i.tags||[]).map(t=>t.toLowerCase());
      if(!queryTags.every(t => itags.includes(t.toLowerCase()))) return false;
    }
    return true;
  });

  // sort
  const s = (sortSelect?.value || 'newest');
  if(s === 'newest') filtered.sort((a,b)=> (b.uploadedAt||0) - (a.uploadedAt||0));
  if(s === 'oldest') filtered.sort((a,b)=> (a.uploadedAt||0) - (b.uploadedAt||0));
  if(s === 'az') filtered.sort((a,b)=> a.title.localeCompare(b.title));
  if(s === 'za') filtered.sort((a,b)=> b.title.localeCompare(a.title));
}

function renderGallery(resetChunk=false){
  applyFiltersAndSort();
  if(resetChunk) renderedCount = 0;
  const toRender = filtered.slice(renderedCount, renderedCount + renderChunk);
  if(resetChunk) gallery.innerHTML = '';
  toRender.forEach((imgObj, localIdx) => {
    const idx = renderedCount + localIdx;
    const card = buildCard(imgObj, idx);
    gallery.appendChild(card);
  });
  renderedCount += toRender.length;
  updateCount();
  // if there are more items, add "load more" sentinel
  ensureLoadMoreSentinel();
}

function ensureLoadMoreSentinel(){
  // remove existing sentinel
  const existing = document.getElementById('loadMoreSentinel');
  if(existing) existing.remove();
  if(renderedCount < filtered.length){
    const sentinel = document.createElement('div');
    sentinel.id = 'loadMoreSentinel';
    sentinel.style.cssText = 'padding:12px;text-align:center;color:var(--muted);';
    sentinel.textContent = 'Scroll to load more...';
    gallery.appendChild(sentinel);
  }
}

/* build a card DOM (with edit, delete, reorder buttons etc.) */
function buildCard(imgObj, idx){
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.index = idx;

  // image wrapper and img
  const imgWrap = document.createElement('div'); imgWrap.className = 'img-wrap';
  const img = document.createElement('img');
  img.loading = 'lazy'; img.decoding = 'async'; img.alt = imgObj.title || '';
  img.src = imgObj.src;
  img.title = imgObj.title || '';
  imgWrap.appendChild(img);
  card.appendChild(imgWrap);

  // image click -> lightbox
  img.addEventListener('click', ()=> openLightbox(idx));

  // tilt hover effect
  imgWrap.addEventListener('pointermove', e => {
    const r = imgWrap.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top + r.height/2;
    const dx = (e.clientX - cx)/(r.width/2);
    const dy = (e.clientY - cy)/(r.height/2);
    img.style.transform = `scale(1.04) rotateX(${(-dy*4).toFixed(2)}deg) rotateY(${(dx*4).toFixed(2)}deg)`;
  });
  imgWrap.addEventListener('pointerleave', ()=> img.style.transform = '');

  // like button
  const like = document.createElement('button'); like.className = 'like-btn';
  like.title = favs.includes(imgObj.id) ? 'Unfavorite' : 'Add to favorites';
  like.innerText = favs.includes(imgObj.id) ? '❤️' : '♡';
  like.addEventListener('click', (ev)=> { ev.stopPropagation(); toggleFav(imgObj.id); like.innerText = favs.includes(imgObj.id) ? '❤️' : '♡'; });
  card.appendChild(like);

  // meta area
  const meta = document.createElement('div'); meta.className = 'meta';
  // left: title + tags
  const left = document.createElement('div');
  left.innerHTML = `<strong>${escapeHtml(imgObj.title || '(untitled)')}</strong><div style="font-size:12px;color:var(--muted)">${escapeHtml(imgObj.tags?(imgObj.tags.join(', ')):'')}</div>`;
  // right: tag + actions
  const right = document.createElement('div');

  const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = imgObj.category || 'other';
  right.appendChild(tag);

  // action buttons: edit, delete, move up/down, share
  const btnStyle = 'margin-left:6px;padding:6px;border-radius:6px;border:none;background:rgba(255,255,255,0.03);cursor:pointer';
  const editBtn = document.createElement('button'); editBtn.type='button'; editBtn.title='Edit'; editBtn.style.cssText=btnStyle; editBtn.innerText='✎';
  editBtn.addEventListener('click', (e)=> { e.stopPropagation(); openEditModal(imgObj); });

  const deleteBtn = document.createElement('button'); deleteBtn.type='button'; deleteBtn.title='Delete'; deleteBtn.style.cssText=btnStyle; deleteBtn.innerText='🗑';
  deleteBtn.addEventListener('click', (e)=> { e.stopPropagation(); deleteToTrash(imgObj.id); });

  const upBtn = document.createElement('button'); upBtn.type='button'; upBtn.title='Move up'; upBtn.style.cssText=btnStyle; upBtn.innerText='↑';
  upBtn.addEventListener('click', (e)=>{ e.stopPropagation(); moveImage(imgObj.id, -1); });

  const downBtn = document.createElement('button'); downBtn.type='button'; downBtn.title='Move down'; downBtn.style.cssText=btnStyle; downBtn.innerText='↓';
  downBtn.addEventListener('click', (e)=>{ e.stopPropagation(); moveImage(imgObj.id, +1); });

  const shareBtn = document.createElement('button'); shareBtn.type='button'; shareBtn.title='Share'; shareBtn.style.cssText=btnStyle; shareBtn.innerText='🔗';
  shareBtn.addEventListener('click', (e)=>{ e.stopPropagation(); shareImage(imgObj); });

  right.appendChild(editBtn);
  right.appendChild(deleteBtn);
  right.appendChild(upBtn);
  right.appendChild(downBtn);
  right.appendChild(shareBtn);

  meta.appendChild(left); meta.appendChild(right);
  card.appendChild(meta);

  return card;
}

/* ------------------ Actions: delete, edit, move ------------------ */
function deleteToTrash(id){
  const idx = images.findIndex(x => x.id === id);
  if(idx === -1) return;
  const item = images.splice(idx,1)[0];
  item._deletedAt = Date.now();
  trash.unshift(item);
  saveImages(); saveTrash();
  renderGallery(true);
  alert('Moved to Trash. Open Trash to restore or permanently delete.');
}

function restoreFromTrash(id){
  const idx = trash.findIndex(x => x.id === id);
  if(idx === -1) return;
  const item = trash.splice(idx,1)[0];
  delete item._deletedAt;
  images.unshift(item);
  saveImages(); saveTrash();
  renderGallery(true);
}

function permanentlyDelete(id){
  const idx = trash.findIndex(x => x.id === id);
  if(idx === -1) return;
  trash.splice(idx,1);
  saveTrash();
  renderTrashList();
}

/* move image up/down in images array */
function moveImage(id, dir){
  const idx = images.findIndex(x => x.id === id);
  if(idx === -1) return;
  const newIdx = idx + dir;
  if(newIdx < 0 || newIdx >= images.length) return;
  const [item] = images.splice(idx,1);
  images.splice(newIdx,0,item);
  saveImages();
  renderGallery(true);
}

/* Edit modal: rename, change category, replace file, tags, album */
function openEditModal(imgObj){
  // create a simple edit modal reusing upload modal markup
  let editModal = document.getElementById('editModal');
  if(!editModal){
    const div = document.createElement('div'); div.id='editModal'; div.className='modal';
    div.innerHTML = `
      <div class="modal-inner">
        <h3>Edit Image</h3>
        <form id="editForm">
          <label>Title: <input id="editTitle" type="text"></label>
          <label>Category:
            <select id="editCategory">
              <option value="nature">Nature</option>
              <option value="architecture">Architecture</option>
              <option value="people">People</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>Tags (comma): <input id="editTags"></label>
          <label>Replace image: <input id="editFile" type="file" accept="image/*"></label>
          <label>Album:
            <select id="editAlbum"></select>
          </label>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
            <button type="submit" class="primary">Save</button>
            <button type="button" id="editCancel">Cancel</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(div);
    editModal = document.getElementById('editModal');
  }

  // populate fields
  $('#editTitle').value = imgObj.title || '';
  $('#editCategory').value = imgObj.category || 'other';
  $('#editTags').value = (imgObj.tags||[]).join(', ');
  // populate album select
  populateAlbumSelect($('#editAlbum'));

  // show modal
  openModal(editModal);

  // handle submit
  const editForm = document.getElementById('editForm');
  const cancel = document.getElementById('editCancel');
  const fileInput = document.getElementById('editFile');

  const submitHandler = async (ev) => {
    ev.preventDefault();
    const title = $('#editTitle').value.trim() || autoTitle();
    const category = $('#editCategory').value;
    const tags = ($('#editTags').value || '').split(',').map(s=>s.trim()).filter(Boolean);
    const album = ($('#editAlbum').value || '__default');
    if(fileInput.files && fileInput.files[0]){
      const dataUrl = await readFileAsDataURL(fileInput.files[0]);
      imgObj.src = dataUrl;
    }
    imgObj.title = title; imgObj.category = category; imgObj.tags = tags; imgObj.album = album;
    saveImages();
    closeModal(editModal);
    renderGallery(true);
    editForm.removeEventListener('submit', submitHandler);
  };

  editForm.addEventListener('submit', submitHandler);
  cancel.onclick = ()=> { closeModal(editModal); editForm.removeEventListener('submit', submitHandler); };
}

/* ------------------ Uploads (drag & drop + form) ------------------ */
function openUploadModal(){ populateUploadAlbumSelect(); openModal(uploadModal); }
function closeUploadModal(){ closeModal(uploadModal); uploadForm.reset(); }

uploadOpenBtn?.addEventListener('click', openUploadModal);
uploadCancel?.addEventListener('click', closeUploadModal);

uploadForm?.addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  const file = uploadFile.files[0];
  if(!file) return alert('Select a file.');
  const rawTitle = uploadTitle.value.trim();
  const title = rawTitle || autoTitle();
  const category = uploadCategory.value || 'other';
  const tags = (uploadTags.value || '').split(',').map(s=>s.trim()).filter(Boolean);
  const albumSel = uploadAlbum.value || '__default';
  const dataUrl = await readFileAsDataURL(file);
  const id = 'u' + Date.now();
  const obj = { id, title, src: dataUrl, category, tags, uploadedAt: Date.now(), isUploaded:true, album: albumSel };
  images.unshift(obj); saveImages();
  closeUploadModal(); renderGallery(true);
});

/* drag & drop on whole window for upload */
['dragenter','dragover'].forEach(ev => {
  window.addEventListener(ev, (e)=> {
    e.preventDefault(); e.stopPropagation();
    const overlay = document.getElementById('dropOverlay');
    if(overlay) overlay.style.display = 'flex';
  });
});
['dragleave','drop'].forEach(ev => {
  window.addEventListener(ev, (e)=> {
    e.preventDefault(); e.stopPropagation();
    const overlay = document.getElementById('dropOverlay');
    if(overlay) overlay.style.display = 'none';
  });
});
window.addEventListener('drop', async (e)=>{
  if(!e.dataTransfer) return;
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if(files.length === 0) return;
  for(const f of files){
    const dataUrl = await readFileAsDataURL(f);
    const id = 'u' + Date.now() + Math.floor(Math.random()*99);
    const title = autoTitle();
    const obj = { id, title, src: dataUrl, category: uploadCategory?.value || 'other', tags: [], uploadedAt: Date.now(), isUploaded:true };
    images.unshift(obj);
    saveImages();
  }
  renderGallery(true);
  alert(`${files.length} image(s) uploaded via drag & drop.`);
});

/* ------------------ Utilities ------------------ */
function readFileAsDataURL(file){
  return new Promise((res, rej)=>{
    const r = new FileReader();
    r.onload = ()=> res(r.result);
    r.onerror = ()=> rej(r.error);
    r.readAsDataURL(file);
  });
}

function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* Auto title generator (random) */
function autoTitle(){
  const adj = ['Golden','Silent','Misty','Hidden','Radiant','Lonely','Quiet','Vibrant','Distant','Luminous'];
  const noun = ['Valley','Sunset','Path','Bridge','Skyline','Portrait','Cove','Forest','Peak','Harbor'];
  return `${adj[Math.floor(Math.random()*adj.length)]} ${noun[Math.floor(Math.random()*noun.length)]}`;
}

/* ------------------ Lightbox / Zoom / Share / Download ------------------ */
function openLightbox(index){
  currentIndex = index;
  if(filtered.length === 0) return;
  const item = filtered[currentIndex];
  lbImg.src = item.src;
  lbTitle.textContent = item.title || '';
  lbCategory.textContent = item.category || '';
  lbFav.innerText = favs.includes(item.id) ? '❤️' : '♡';
  lbDownload.onclick = ()=> downloadImage(item);
  lb.classList.add('show'); lb.setAttribute('aria-hidden','false'); document.body.style.overflow = 'hidden';
  // reset zoom
  if(lbZoom) { lbZoom.value = 100; lbImg.style.transform = 'scale(1)'; }
}

function closeLightbox(){ lb.classList.remove('show'); lb.setAttribute('aria-hidden','true'); document.body.style.overflow = ''; stopSlideshow(); }

function nextInLightbox(){ if(!filtered.length) return; currentIndex = (currentIndex + 1) % filtered.length; openLightbox(currentIndex); }
function prevInLightbox(){ if(!filtered.length) return; currentIndex = (currentIndex - 1 + filtered.length) % filtered.length; openLightbox(currentIndex); }

function downloadImage(item){
  // simple download of data URL or remote URL
  const a = document.createElement('a');
  a.href = item.src;
  // sanitize filename
  const name = (item.title || 'image').replace(/\s+/g,'_').replace(/[^\w\-\.]/g,'');
  a.download = name + (item.src.includes('data:') ? '' : '.jpg');
  document.body.appendChild(a); a.click(); a.remove();
}

/* Zoom control */
if(window) {
  document.addEventListener('input', (e)=>{
    if(e.target && e.target.id === 'lbZoom' && lbImg){
      const v = +e.target.value;
      const s = v/100;
      lbImg.style.transform = `scale(${s})`;
    }
  });
}

/* Share: copy link (data URL or remote link), and WhatsApp share */
async function shareImage(item){
  try{
    if(navigator.clipboard){
      await navigator.clipboard.writeText(item.src);
      alert('Image URL copied to clipboard. You can paste it anywhere to share.');
    } else {
      prompt('Copy this link:', item.src);
    }
    // whatsapp quick share
    const w = confirm('Open WhatsApp share window?');
    if(w){
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(item.title + ' ' + item.src)}`;
      window.open(url, '_blank');
    }
  }catch(e){ console.error(e); prompt('Copy this link:', item.src); }
}

/* Download all images as ZIP using JSZip loaded dynamically */
async function downloadAllAsZip(){
  if(!confirm('Download all currently filtered images as a ZIP file?')) return;
  // dynamic load JSZip
  if(typeof window.JSZip === 'undefined'){
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
  }
  const zip = new window.JSZip();
  const folder = zip.folder('images');
  const list = filtered.slice(); // current filtered set
  const fetches = list.map(async (it, i) => {
    try {
      // if data URL: convert to blob
      if(it.src.startsWith('data:')){
        const res = await fetch(it.src);
        const blob = await res.blob();
        folder.file(`${i+1}_${sanitizeFilename(it.title)}.jpg`, blob);
      } else {
        const resp = await fetch(it.src);
        const blob = await resp.blob();
        folder.file(`${i+1}_${sanitizeFilename(it.title)}.jpg`, blob);
      }
    } catch(e){ console.warn('failed to fetch', it.src, e); }
  });
  await Promise.all(fetches);
  const content = await zip.generateAsync({type:'blob'});
  const url = URL.createObjectURL(content);
  const a = document.createElement('a'); a.href = url; a.download = 'images.zip'; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* load external script */
function loadScript(src){
  return new Promise((res, rej)=>{
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}
function sanitizeFilename(s){ return (s||'image').replace(/[^a-z0-9\-_\.]/gi,'_'); }

/* ------------------ Favorites ------------------ */
function toggleFav(id){
  const idx = favs.indexOf(id);
  if(idx >= 0) favs.splice(idx,1); else favs.push(id);
  saveFavs();
  renderGallery(true);
}

/* ------------------ Trash UI ------------------ */
function openModal(modal){ modal.classList.add('show'); modal.setAttribute('aria-hidden','false'); }
function closeModal(modal){ modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); }

function renderTrashList(){
  const list = document.getElementById('trashList');
  if(!list) return;
  list.innerHTML = '';
  if(trash.length === 0){ list.textContent = 'Trash is empty.'; return; }
  trash.forEach(item=>{
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;align-items:center;padding:8px;border-bottom:1px solid rgba(255,255,255,0.03)';
    row.innerHTML = `<img src="${item.src}" style="width:60px;height:40px;object-fit:cover;border-radius:6px"><div style="flex:1"><strong>${escapeHtml(item.title)}</strong><div style="font-size:12px;color:var(--muted)">${escapeHtml(item.category)}</div></div>`;
    const rbtn = document.createElement('button'); rbtn.textContent = 'Restore'; rbtn.className='primary'; rbtn.onclick = ()=> { restoreFromTrash(item.id); renderTrashList(); };
    const delbtn = document.createElement('button'); delbtn.textContent = 'Delete'; delbtn.onclick = ()=> { permanentlyDelete(item.id); renderTrashList(); };
    const actionWrap = document.createElement('div'); actionWrap.style.display='flex'; actionWrap.style.gap='6px'; actionWrap.appendChild(rbtn); actionWrap.appendChild(delbtn);
    row.appendChild(actionWrap);
    list.appendChild(row);
  });
}
document.addEventListener('click', (e)=> {
  if(e.target && e.target.id === 'openTrashBtn') { renderTrashList(); openModal(trashModal); }
  if(e.target && e.target.id === 'closeTrashBtn') closeModal(trashModal);
  if(e.target && e.target.id === 'emptyTrashBtn'){ if(confirm('Empty trash permanently?')){ trash = []; saveTrash(); renderTrashList(); } }
});

/* ------------------ Albums ------------------ */
function populateAlbumSelect(selectEl){
  if(!selectEl) return;
  selectEl.innerHTML = '';
  // ensure default
  if(!albums || Object.keys(albums).length === 0) albums = {"__default":"All"};
  Object.keys(albums).forEach(k => {
    const opt = document.createElement('option'); opt.value = k; opt.textContent = albums[k]; selectEl.appendChild(opt);
  });
}

function populateUploadAlbumSelect(){
  populateAlbumSelect(uploadAlbum);
}

function renderAlbumsList(){
  const lst = document.getElementById('albumsList');
  if(!lst) return;
  lst.innerHTML = '';
  Object.keys(albums).forEach(k=>{
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid rgba(255,255,255,0.03)';
    const left = document.createElement('div'); left.innerHTML = `<strong>${escapeHtml(albums[k])}</strong><div style="font-size:12px;color:var(--muted)">${k}</div>`;
    const rm = document.createElement('button'); rm.textContent='Delete'; rm.onclick = ()=> {
      if(k === '__default'){ alert('Default album cannot be deleted.'); return; }
      if(confirm('Delete album? Images will remain in default album.')){
        // move images in this album to default
        images.forEach(it=> { if(it.album === k) it.album = '__default'; });
        delete albums[k];
        saveAlbums(); saveImages(); renderAlbumsList(); populateUploadAlbumSelect(); renderGallery(true);
      }
    };
    row.appendChild(left); row.appendChild(rm);
    lst.appendChild(row);
  });
}

document.addEventListener('click', (e)=> {
  if(e.target && e.target.id === 'createAlbumBtn'){
    const name = $('#newAlbumName').value.trim();
    if(!name) return alert('Enter album name');
    const key = 'alb_' + Date.now();
    albums[key] = name;
    saveAlbums();
    $('#newAlbumName').value = '';
    renderAlbumsList(); populateUploadAlbumSelect();
  }
  if(e.target && e.target.id === 'closeAlbumsBtn') closeModal(albumsPanel);
  if(e.target && e.target.id === 'openAlbumsBtn'){ renderAlbumsList(); openModal(albumsPanel); }
});

/* ------------------ Filters Panel (CSS filters) ------------------ */
document.addEventListener('click', (e)=> {
  if(e.target && e.target.id === 'applyFiltersBtn'){
    galleryFilters.cssFilters.grayscale = +$('#filterGrayscale').value;
    galleryFilters.cssFilters.blur = +$('#filterBlur').value;
    galleryFilters.cssFilters.contrast = +$('#filterContrast').value;
    applyCssFiltersToGallery();
    closeModal(filtersPanel);
  }
  if(e.target && e.target.id === 'closeFiltersBtn') closeModal(filtersPanel);
});
function applyCssFiltersToGallery(){
  const f = galleryFilters.cssFilters;
  const imgs = gallery.querySelectorAll('img');
  imgs.forEach(im => {
    im.style.filter = `grayscale(${f.grayscale/100}) blur(${f.blur}px) contrast(${f.contrast}%)`;
  });
}

/* ------------------ Infinite scroll handler ------------------ */
window.addEventListener('scroll', ()=> {
  const sentinel = document.getElementById('loadMoreSentinel');
  if(!sentinel) return;
  const rect = sentinel.getBoundingClientRect();
  if(rect.top < window.innerHeight + 200){
    // load next chunk
    renderGallery();
  }
});

/* ------------------ Bind UI events ------------------ */
function bindUI(){
  // search, category, sort
  searchInput?.addEventListener('input', ()=> { galleryFilters.q = searchInput.value; renderGallery(true); });
  categoryFilter?.addEventListener('input', ()=> { galleryFilters.category = categoryFilter.value; renderGallery(true); });
  sortSelect?.addEventListener('input', ()=> renderGallery(true));
  autoplaySelect?.addEventListener('change', ()=> {
    autoplayMs = +autoplaySelect.value; if(isPlaying) playSlideshow(autoplayMs);
  });

  tabButtons.forEach(btn => btn.addEventListener('click', (e)=>{
    tabButtons.forEach(b=>b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    currentTab = e.currentTarget.dataset.tab || 'all';
    renderGallery(true);
  }));

  // lightbox events
  document.addEventListener('click', (e)=> {
    if(e.target && e.target.id === 'lbClose') closeLightbox();
    if(e.target && e.target.id === 'lbNext') nextInLightbox();
    if(e.target && e.target.id === 'lbPrev') prevInLightbox();
    if(e.target && e.target.id === 'lbPlay') togglePlayPause();
    if(e.target && e.target.id === 'lbFav'){ const id = filtered[currentIndex].id; toggleFav(id); document.getElementById('lbFav').innerText = favs.includes(id)?'❤️':'♡'; }
    if(e.target && e.target.id === 'lbDownload'){ downloadImage(filtered[currentIndex]); }
    if(e.target && e.target.id === 'lbShare'){ shareImage(filtered[currentIndex]); }
  });

  // global keyboard navigation
  document.addEventListener('keydown', (e)=> {
    if(e.key === 'Escape') closeLightbox();
    if(e.key === 'ArrowRight') { if(lb.classList.contains('show')) nextInLightbox(); }
    if(e.key === 'ArrowLeft') { if(lb.classList.contains('show')) prevInLightbox(); }
    if(e.key === ' ') { e.preventDefault(); togglePlayPause(); }
    if(isKeyboardMode){
      if(['w','W'].includes(e.key)) { if(lb.classList.contains('show')) prevInLightbox(); else scrollBy(0,-200); }
      if(['s','S'].includes(e.key)) { if(lb.classList.contains('show')) nextInLightbox(); else scrollBy(0,200); }
      if(['a','A'].includes(e.key)) { /* optional left action */ scrollBy(-200,0); }
      if(['d','D'].includes(e.key)) { /* optional right action */ scrollBy(200,0); }
    }
  });

  // slideshow toggle in header
  slideshowToggle?.addEventListener('click', ()=> togglePlayPause());
  // theme toggle
  themeToggle?.addEventListener('click', ()=> {
    const current = document.body.classList.contains('light-theme') ? 'light' : 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    applyTheme(next); saveTheme(next);
  });

  // fullscreen
  fullscreenBtn?.addEventListener('click', ()=> {
    if(!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
    else document.exitFullscreen().catch(()=>{});
  });

  // open filters panel (attach to an existing control or create new)
  const filtersBtn = document.getElementById('openFiltersBtn');
  if(!filtersBtn){
    const leftControls = document.querySelector('.left-controls');
    if(leftControls){
      const fbtn = document.createElement('button'); fbtn.id='openFiltersBtn'; fbtn.textContent='Filters ⚙️'; fbtn.style.cssText='padding:8px;border-radius:8px;background:rgba(255,255,255,0.03);border:none;';
      leftControls.appendChild(fbtn);
      fbtn.addEventListener('click', ()=> openModal(filtersPanel));
    }
  }
}

/* ------------------ Play / Stop slideshow ------------------ */
function playSlideshow(ms){
  stopSlideshow();
  if(!ms || ms <= 0) return;
  isPlaying = true; slideshowToggle.textContent = '⏸';
  slideshowTimer = setInterval(()=> {
    currentIndex = (currentIndex + 1) % filtered.length;
    openLightbox(currentIndex);
  }, ms);
}
function stopSlideshow(){
  isPlaying = false; slideshowToggle.textContent = '▶️';
  if(slideshowTimer){ clearInterval(slideshowTimer); slideshowTimer = null; }
}
function togglePlayPause(){
  if(isPlaying) stopSlideshow(); else {
    if(!lb.classList.contains('show') && filtered.length) openLightbox(0);
    playSlideshow(autoplayMs || 3000);
  }
}

/* ------------------ Apply theme ------------------ */
function applyTheme(name){
  if(name === 'light'){ document.body.classList.add('light-theme'); themeToggle && (themeToggle.textContent = '☀️'); }
  else { document.body.classList.remove('light-theme'); themeToggle && (themeToggle.textContent = '🌙'); }
}

/* ------------------ Misc helpers ------------------ */
function updateCount(){ countEl && (countEl.textContent = filtered.length); }

/* ------------------ When clicking outside modals close them ------------------ */
document.addEventListener('click', (e)=>{
  if(e.target && e.target.classList && e.target.classList.contains('modal')) closeModal(e.target);
  if(e.target && e.target.id === 'dropOverlay') document.getElementById('dropOverlay').style.display = 'none';
});

/* ------------------ Init: populate album selects and event wiring for modals ------------------ */
(function initExtras(){
  // populate upload album select
  populateUploadAlbumSelect();

  // modal buttons wiring
  const closeUpload = document.getElementById('uploadCancel');
  if(closeUpload) closeUpload.addEventListener('click', closeUploadModal);

  // Trash controls
  const emptyTrashBtn = document.getElementById('emptyTrashBtn');
  if(emptyTrashBtn) emptyTrashBtn.addEventListener('click', ()=> { if(confirm('Empty trash permanently?')){ trash = []; saveTrash(); renderTrashList(); }});

  // ensure album list and upload album select reflect albums
  renderAlbumsList(); populateUploadAlbumSelect();

  // ensure filters default values
  if($('#filterGrayscale')) $('#filterGrayscale').value = galleryFilters.cssFilters.grayscale;
  if($('#filterBlur')) $('#filterBlur').value = galleryFilters.cssFilters.blur;
  if($('#filterContrast')) $('#filterContrast').value = galleryFilters.cssFilters.contrast;
})();

/* ------------------ Expose for debug ------------------ */
window.advGallery = { images, applyAndRender: ()=>{ renderGallery(true); }, openLightbox, toggleFav, getState: ()=> ({images,favs,trash,albums}) };

/* ------------------ Done ------------------ */
console.log('Advanced gallery script loaded — all features enabled.');
