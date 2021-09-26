const { desktopCapturer, ipcRenderer } = require("electron");
const { writeFile } = require("fs");
let mediaRecorder;
let recordedChunks = [];

const videoElement = document.querySelector("video");
const startButton = document.getElementById("startButton");

startButton.onclick = (e) => {
  const seletEl = document.getElementById("sourceSelect");
  const selectedOption = seletEl.options[seletEl.selectedIndex];

  selectSource({
    name: selectedOption.innerText,
    id: selectedOption.value,
  }).then(() => {
    mediaRecorder.start();
    startButton.classList.add("is-danger");
    startButton.innerText = "Recording";

    controlsStates("recording");
  });
};

const stopButton = document.getElementById("stopButton");

stopButton.onclick = (e) => {
  if (mediaRecorder.state != "inactive") {
    mediaRecorder.stop();
    startButton.classList.remove("is-danger");
    startButton.innerText = "Start";
    controlsStates("recording-stoped");
  }
};

const getSourcesButton = document.getElementById("getSourcesButton");
getSourcesButton.onclick = getAvailableVideoSources;

function getAvailableVideoSources() {
  desktopCapturer
    .getSources({
      types: ["window", "screen"],
    })
    .then(async (data) => {
      let selectEl = document.getElementById("sourceSelect");

      if (data.length > 0) {
        [...selectEl.options].forEach((el) => el.remove());
        selectEl.appendChild(document.createElement("option")).innerText =
          "Choose source";
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // audio: true,
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              maxWidth: 4000,
              maxHeight: 4000,
            },
          },
        });

        data.forEach((el) => {
          let option = document.createElement("option");
          option.innerText = el.name.length > 20 ? el.name.split("-").pop().trim() : el.name;
          option.value = el.id;
          selectEl.appendChild(option);
        });

        handleStream(stream);
      } catch (e) {
        console.log(e);
      }
      controlsStates("sources-retrived");
    });
}

function handleStream(stream) {
  const video = document.querySelector("video");
  video.srcObject = stream;
  video.onloadedmetadata = (e) => video.play();
}

async function selectSource(source) {
  const constraints = {
    // audio: true,
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: source.id,
      },
    },
  };

  // Create a Stream
  const stream = await navigator.mediaDevices.getUserMedia(constraints);

  // Preview the source in a video element
  videoElement.srcObject = stream;
  videoElement.play();

  // Create the Media Recorder
  const options = {
    mimeType: "video/webm; codecs=vp9",
    canvas: {
      width: 1920,
      height: 1080,
    },
  };
  mediaRecorder = new MediaRecorder(stream, options);

  // Register Event Handlers
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.onstop = handleStop;
}

// Captures all recorded chunks
function handleDataAvailable(e) {
  console.log("video data available");
  recordedChunks.push(e.data);
}

// Saves the video file on stop
async function handleStop(e) {
  const blob = new Blob(recordedChunks, {
    type: "video/webm; codecs=vp9",
  });

  const buffer = Buffer.from(await blob.arrayBuffer());

  const { filePath } = await ipcRenderer.invoke("show-save-dialog", {
    buttonLabel: "Save video",
    defaultPath: `vid-${Date.now()}.webm`,
  });

  if (filePath) {
    writeFile(filePath, buffer, () => console.log("Video saved"));
  }
}

function controlsStates(state, el) {
  let startButton = document.getElementById("startButton");
  let stopButton = document.getElementById("stopButton");
  let sourceSelect = document.getElementById("sourceSelect");

  if (el && el.options[0].selected == true) {
    // do nothing and disable all contorls, cuz "empty" value is selected
    !startButton.disabled ? startButton.setAttribute("disabled", "") : "";
    !stopButton.disabled ? stopButton.setAttribute("disabled", "") : "";
    return;
  }
  if (state == "sources-retrived") {
    sourceSelect.removeAttribute("disabled");
    return;
  }
  if (state == "source-selected-redy-to-record") {
    startButton.removeAttribute("disabled");
    return;
  }
  if (state == "recording") {
    stopButton.removeAttribute("disabled");
    !startButton.disabled ? startButton.setAttribute("disabled", "") : "";
    return;
  }
  if (state == "recording-stoped") {
    startButton.disabled ? startButton.removeAttribute("disabled") : "";
    !stopButton.disabled ? stopButton.setAttribute("disabled", "") : "";
    return;
  }
}
