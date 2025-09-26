const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const gestureText = document.getElementById('gesture');
const videoPlayer = document.getElementById('videoPlayer');
const startBtn = document.getElementById('startBtn');
const videoFileInput = document.getElementById('videoFile');
const showZonesEl = document.getElementById('showZones');
const volumeBarEl = document.getElementById('volumeBar');
let hasRequestedCamera = false;

let model = null;
let isVideo = false;

const modelParams = {
  flipHorizontal: true,
  maxNumBoxes: 1,
  iouThreshold: 0.5,
  scoreThreshold: 0.6,
};

async function startVideo() {
  gestureText.innerText = "Requesting camera...";
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    gestureText.innerText = "Camera API not supported in this browser.";
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    if (video) {
      video.setAttribute('playsinline', 'true');
      video.muted = true;
      video.srcObject = stream;
      await video.play();
    }
    isVideo = true;
    gestureText.innerText = "Camera started";
    runDetection();
  } catch (err) {
    console.error('getUserMedia error', err);
    if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
      gestureText.innerText = "Camera permission denied. Click the lock icon in the address bar and allow Camera.";
    } else if (err && err.name === 'NotFoundError') {
      gestureText.innerText = "No camera device found.";
    } else {
      gestureText.innerText = `Camera error: ${err && err.message ? err.message : err}`;
    }
  }
}

function runDetection() {
  if (!model || !isVideo) {
    // Try again shortly once model/video are ready
    requestAnimationFrame(runDetection);
    return;
  }
  model.detect(video).then(predictions => {
    context.clearRect(0, 0, canvas.width, canvas.height);

    const width = canvas.width;
    const height = canvas.height;

    // Optional debug grid/zones
    const showZones = showZonesEl ? showZonesEl.checked : true;
    if (showZones) {
      context.save();
      context.strokeStyle = 'rgba(0,0,0,0.5)';
      context.lineWidth = 1;
      // Vertical thirds
      context.beginPath();
      context.moveTo(width / 3, 0);
      context.lineTo(width / 3, height);
      context.moveTo((width * 2) / 3, 0);
      context.lineTo((width * 2) / 3, height);
      // Horizontal thirds
      context.moveTo(0, height / 3);
      context.lineTo(width, height / 3);
      context.moveTo(0, (height * 2) / 3);
      context.lineTo(width, (height * 2) / 3);
      context.stroke();

      // Zone labels
      context.fillStyle = 'rgba(0,0,0,0.6)';
      context.font = '12px sans-serif';
      context.fillText('Play', width / 2 - 14, 12);
      context.fillText('Pause', width / 2 - 18, height - 4);
      context.fillText('Rewind', 6, height / 2 + 4);
      context.fillText('Vol+', width - 34, 12);
      context.fillText('Vol-', width - 34, height - 4);
      context.fillText('Fwd', width - 28, height / 2 + 4);
      context.restore();
    }

    let currentAction = null;

    // If a face is detected by the model, do not perform any action
    const hasFace = predictions.some(p => {
      const lbl = (p && (p.label || p.class)) ? String(p.label || p.class).toLowerCase() : '';
      return lbl.includes('face');
    });

    if (predictions.length > 0) {

      if (hasFace) {
        gestureText.innerText = "Face detected - no action";
      } else {
      const hand = predictions[0];
      const bbox = hand.bbox; // [x, y, width, height]
      const x = bbox[0];
      const y = bbox[1];
      const w = bbox[2];
      const h = bbox[3];

      if (y < height / 3 && x > (width * 2) / 3) {
        gestureText.innerText = "Volume Up";
        videoPlayer.volume = Math.min(1, videoPlayer.volume + 0.05);
        currentAction = 'volUp';
      }
      else if (y > (height * 2) / 3 && x > (width * 2) / 3) {
        gestureText.innerText = "Volume Down";
        videoPlayer.volume = Math.max(0, videoPlayer.volume - 0.05);
        currentAction = 'volDown';
      }
      else if (y < height / 3 && x > width / 3 && x < (width * 2) / 3) {
        gestureText.innerText = "Play";
        if (videoPlayer.paused) videoPlayer.play();
        currentAction = 'play';
      }
      else if (y > (height * 2) / 3 && x > width / 3 && x < (width * 2) / 3) {
        gestureText.innerText = "Pause";
        if (!videoPlayer.paused) videoPlayer.pause();
        currentAction = 'pause';
      }
      else if (x < width / 3) {
        gestureText.innerText = "Rewind 5s";
        videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 5);
        currentAction = 'rewind';
      }
      else if (x > (width * 2) / 3) {
        if (y > height / 3 && y < (height * 2) / 3) {
          gestureText.innerText = "Forward 5s";
          videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 5);
          currentAction = 'forward';
        } else {
          gestureText.innerText = "Hand detected - no action";
        }
      } else {
        gestureText.innerText = "Hand detected - no action";
      }
      }
    } else {
      gestureText.innerText = "No hand detected";
    }

    // Highlight the active zone for a brief visual cue
    if (showZones && currentAction) {
      context.save();
      context.globalAlpha = 0.2;
      context.fillStyle = '#4caf50';
      const thirdW = width / 3;
      const thirdH = height / 3;
      if (currentAction === 'volUp') context.fillRect(thirdW * 2, 0, thirdW, thirdH);
      if (currentAction === 'volDown') context.fillRect(thirdW * 2, thirdH * 2, thirdW, thirdH);
      if (currentAction === 'play') context.fillRect(thirdW, 0, thirdW, thirdH);
      if (currentAction === 'pause') context.fillRect(thirdW, thirdH * 2, thirdW, thirdH);
      if (currentAction === 'rewind') context.fillRect(0, 0, thirdW, height);
      if (currentAction === 'forward') context.fillRect(thirdW * 2, thirdH, thirdW, thirdH);
      context.restore();
    }

    // Update visual volume bar
    // Volume bar removed from UI; keep no-op guard
    if (volumeBarEl) {
      const pct = Math.max(0, Math.min(1, videoPlayer.volume));
      volumeBarEl.style.width = `${pct * 100}%`;
    }

    if (isVideo) {
      requestAnimationFrame(runDetection);
    }
  });
}

// Attach click handler immediately so Firefox treats it as a user gesture
if (startBtn) {
  startBtn.addEventListener('click', () => {
    if (hasRequestedCamera) return;
    hasRequestedCamera = true;
    startBtn.disabled = true;
    startVideo();
  });
}

// Allow selecting a local video file
if (videoFileInput && videoPlayer) {
  videoFileInput.addEventListener('change', () => {
    const file = videoFileInput.files && videoFileInput.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    // Replace current source
    videoPlayer.src = url;
    videoPlayer.play().catch(() => {});
  });
}

handTrack
  .load(modelParams)
  .then(lmodel => {
    model = lmodel;
    if (!hasRequestedCamera) {
      gestureText.innerText = "Model loaded. Click Start Camera.";
      if (startBtn) startBtn.disabled = false;
    } else {
      // Camera already started; begin detection now
      runDetection();
    }
  })
  .catch(err => {
    gestureText.innerText = `Model load error: ${err && err.message ? err.message : err}`;
  });

// Scroll reveal animations
(() => {
  const revealEls = Array.from(document.querySelectorAll('[data-reveal]'));
  if (!('IntersectionObserver' in window) || revealEls.length === 0) return;
  const onIntersect = entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('show');
        observer.unobserve(entry.target);
      }
    }
  };
  const observer = new IntersectionObserver(onIntersect, { threshold: 0.12 });
  revealEls.forEach(el => observer.observe(el));
})();
