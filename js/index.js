const cam = document.querySelector('#cam');

const startVideo = () => {
  navigator.mediaDevices.enumerateDevices().then((devices) => {
    console.log(devices);
    if (Array.isArray(devices)) {
      devices.forEach((device) => {
        if (device.kind === 'videoinput') {
          if (device.label.includes('Logitech')) {
            navigator.getUserMedia(
              { video: { deviceId: device.deviceId } },
              (stream) => (cam.srcObject = stream),
              (error) => console.error(error),
            );
          }
        }
      });
    }
  });
};

const loadLabels = () => {
  const labels = ['4A6G0068', '4A6G0067'];
  return Promise.all(
    labels.map(async (label) => {
      const descriptions = [];
      for (let i = 0; i < 1; i++) {
        const img = await faceapi.fetchImage(`/labels/${label}/${i}.jpg`);
        console.log('image loaded');
        const detections = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor();
        descriptions.push(detections.descriptor);
      }
      return new faceapi.LabeledFaceDescriptors(label, descriptions);
    }),
  );
};

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
  faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
  faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
  faceapi.nets.faceExpressionNet.loadFromUri('/models'),
  faceapi.nets.ageGenderNet.loadFromUri('/models'),
  faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
]).then(startVideo);

cam.addEventListener('play', async () => {
  console.log('ff');
  const canvas = faceapi.createCanvasFromMedia(cam);
  const canvasSize = { width: cam.width, height: cam.height };
  const labels = await loadLabels();
  faceapi.matchDimensions(canvas, canvasSize);
  document.body.appendChild(canvas);
  setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(cam, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions()
      .withAgeAndGender()
      .withFaceDescriptors();
    const resizeDetections = faceapi.resizeResults(detections, canvasSize);
    const faceMatcher = new faceapi.FaceMatcher(labels, 0.6);
    const results = resizeDetections.map((d) =>
      faceMatcher.findBestMatch(d.descriptor),
    );
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    faceapi.draw.drawDetections(canvas, resizeDetections);
    faceapi.draw.drawFaceLandmarks(canvas, resizeDetections);
    faceapi.draw.drawFaceExpressions(canvas, resizeDetections);
    resizeDetections.forEach((detection) => {
      const { age, gender, genderProbability } = detection;
      new faceapi.draw.DrawTextField(
        [
          `${parseInt(age, 10)} 歲`,
          `${gender} (${parseInt(genderProbability * 100, 10)})`,
        ],
        detection.detection.box.topRight,
      ).draw(canvas);
    });
    results.forEach((result, index) => {
      const box = resizeDetections[index].detection.box;
      const { label, distance } = result;
      new faceapi.draw.DrawTextField(
        [`${label} (${parseInt(distance * 100, 10)})`],
        box.bottomRight,
      ).draw(canvas);
    });
  }, 100);
});
