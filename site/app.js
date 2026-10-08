// Landing page: OS-aware download links from the latest GitHub release + live tray price from the demo.
const REPO = 'jonacarbi/crypto-calculator';
const RELEASES = `https://github.com/${REPO}/releases`;
const LABELS = { mac: 'macOS', windows: 'Windows', linux: 'Linux' };

function detectOs() {
  const p = (navigator.userAgentData?.platform || navigator.platform || navigator.userAgent).toLowerCase();
  if (p.includes('mac')) return 'mac';
  if (p.includes('win')) return 'windows';
  if (p.includes('linux') && !/android/i.test(navigator.userAgent)) return 'linux';
  return null;
}

const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;
const kind = (name) => (name.endsWith('.dmg') ? 'Disk image (.dmg)'
  : name.endsWith('-setup.exe') ? 'Installer (.exe)'
  : name.endsWith('.msi') ? 'MSI package'
  : name.endsWith('.AppImage') ? 'AppImage'
  : name.endsWith('.deb') ? 'Debian / Ubuntu (.deb)'
  : name.endsWith('.rpm') ? 'Fedora / RHEL (.rpm)' : name);

function fileLink(asset) {
  const a = document.createElement('a');
  a.href = asset.browser_download_url;
  a.append(kind(asset.name));
  const size = document.createElement('small');
  size.textContent = mb(asset.size);
  a.append(size);
  const li = document.createElement('li');
  li.append(a);
  return li;
}

function pending(list) {
  const li = document.createElement('li');
  li.className = 'pending';
  const a = document.createElement('a');
  a.href = RELEASES;
  a.textContent = 'See all builds on GitHub';
  li.append(a);
  list.replaceChildren(li);
}

async function loadRelease(os) {
  const lists = [...document.querySelectorAll('.files')];
  let assets = [];
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (res.ok) {
      const release = await res.json();
      assets = release.assets ?? [];
      document.getElementById('releaseNote').textContent = `Version ${release.tag_name.replace(/^v/, '')}, built by GitHub Actions from the public source.`;
    }
  } catch { /* offline or rate-limited: fall back to the releases page */ }

  for (const list of lists) {
    const exts = list.dataset.exts.split(' ');
    const mine = exts.flatMap((ext) => assets.filter((a) => a.name.endsWith(ext)));
    if (mine.length) list.replaceChildren(...mine.map(fileLink));
    else pending(list);
  }

  const cta = document.getElementById('heroCta');
  const primary = lists.find((l) => l.closest('.platform').dataset.os === os)?.querySelector('a');
  if (os && primary && primary.href !== RELEASES) {
    cta.href = primary.href;
    cta.textContent = `Download for ${LABELS[os]}`;
    document.getElementById('heroFine').textContent = `${primary.textContent.replace(/(\d)/, ' · $1')} · free and open source`;
  }
}

function trayPrice() {
  const tray = document.getElementById('tray');
  const pill = document.querySelector('.after .pill');
  const show = (d) => {
    if (d?.type !== 'tray' || !Number.isFinite(d.price)) return;
    const text = '₿ ' + new Intl.NumberFormat(undefined, {
      style: 'currency', currency: d.vs.toUpperCase(), maximumFractionDigits: d.price >= 1000 ? 0 : 2,
    }).format(d.price);
    tray.textContent = text;
    pill.textContent = text;
  };
  addEventListener('message', (e) => { if (e.origin === location.origin) show(e.data); });
  show(document.querySelector('.popover iframe').contentWindow?.__tray);
}

function clock() {
  const el = document.getElementById('clock');
  const tick = () => { el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
  tick();
  setInterval(tick, 30_000);
}

const os = detectOs();
if (os) document.querySelector(`.platform[data-os="${os}"]`)?.classList.add('mine');
trayPrice();
clock();
loadRelease(os);
