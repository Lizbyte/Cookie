
/**
 * Fortune Cookie Web — client-side engine
 * Modes:
 *  - Deterministic: if URL contains ?id=XYZ we map that id to a stable index using FNV-1a hash
 *  - Random no-repeat: if no id, we pick randomly while avoiding repeats until we've cycled through all
 *
 * You can program each NFC tag with a unique URL like:
 *   https://yourdomain.example/?id=TAG123
 * or
 *   https://yourdomain.example/?id=NTAG-215-<serial>
 *
 * If you prefer purely random every tap, write just https://yourdomain.example/ on the tag.
 */

(function(){
  const fortunes = (window.FORTUNES || []);
  const $fortune = document.querySelector("#fortune");
  const $id = document.querySelector("#id");
  const $newBtn = document.querySelector("#new");
  const $shareBtn = document.querySelector("#share");
  const $copyBtn = document.querySelector("#copylink");
  const $count = document.querySelector("#count");
  const STORAGE_KEY = "fortune-seen-v1";

  // Read id from query string
  const params = new URLSearchParams(window.location.search);
  const id = (params.get("id") || "").trim();
  if(id){ document.querySelector("#mode").textContent = "Deterministic"; }
  else   { document.querySelector("#mode").textContent = "Random"; }

  function fnv1a32(str){
    let h = 0x811c9dc5;
    for(let i=0; i<str.length; i++){
      h ^= str.charCodeAt(i);
      // 32-bit FNV prime 16777619
      h = (h + ((h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24))) >>> 0;
    }
    return h >>> 0;
  }

  function pickDeterministic(idValue){
    if(fortunes.length === 0) return null;
    const hash = fnv1a32(idValue);
    const idx = hash % fortunes.length;
    return {idx, value: fortunes[idx]};
  }

  function getSeen(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return new Set();
      return new Set(JSON.parse(raw));
    }catch(e){ return new Set(); }
  }

  function setSeen(set){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    }catch(e){ /* ignore */ }
  }

  function pickRandomNoRepeat(){
    if(fortunes.length === 0) return null;
    const seen = getSeen();
    if(seen.size >= fortunes.length){
      // reset cycle
      seen.clear();
    }
    // pick a random index not in seen
    let idx;
    let guard = 0;
    do{
      // cryptographically stronger random when available
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      idx = arr[0] % fortunes.length;
      guard++;
      if(guard > 500) break; // emergency break; shouldn't happen
    }while(seen.has(idx));
    seen.add(idx);
    setSeen(seen);
    return {idx, value: fortunes[idx], seenCount: seen.size};
  }

  function renderFortune(entry){
    if(!entry){ $fortune.textContent = "No fortunes loaded."; return; }
    $fortune.textContent = entry.value;
    if($count){
      if(id){
        $count.textContent = `${entry.idx+1} / ${fortunes.length}`;
      }else{
        // random mode: approximate progress by seen count
        const seen = getSeen();
        $count.textContent = `${seen.size} / ${fortunes.length}`;
      }
    }
  }

  function newFortune(){
    if(id){
      renderFortune(pickDeterministic(id));
    }else{
      renderFortune(pickRandomNoRepeat());
    }
  }

  // Buttons
  $newBtn?.addEventListener("click", newFortune);

  $shareBtn?.addEventListener("click", async () => {
    const shareData = {
      title: document.title,
      text: "Your digital fortune 🍀",
      url: window.location.href
    };
    try{
      if(navigator.share){
        await navigator.share(shareData);
      }else{
        await navigator.clipboard.writeText(window.location.href);
        alert("Link copied to clipboard!");
      }
    }catch(e){ /* cancelled */ }
  });

  $copyBtn?.addEventListener("click", async () => {
    try{
      await navigator.clipboard.writeText(window.location.href);
      $copyBtn.textContent = "Copied!";
      setTimeout(()=> $copyBtn.textContent="Copy link", 1200);
    }catch(e){
      alert("Copy failed — you can copy from the address bar.");
    }
  });

  // On load
  if(id) document.querySelector("#idval").textContent = id;
  newFortune();
})();
