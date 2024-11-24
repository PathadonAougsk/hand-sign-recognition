/*jshint esversion:6*/

$(function () {
    const { InferenceEngine, CVImage } = inferencejs;
    const inferEngine = new InferenceEngine();

    const video = $("video")[0];

    var workerId;
    var cameraMode = "environment"; // or "user"

    const startVideoStreamPromise = navigator.mediaDevices
    .getUserMedia({
        audio: false,
        video: {
            facingMode: cameraMode,
            width: { ideal: 640 },  // Set the width to 640px
            height: { ideal: 480 }  // Set the height to 480px
        }
    })
    .then(function (stream) {
        return new Promise(function (resolve) {
            video.srcObject = stream;   
            video.onloadeddata = function () {
                video.play();
                resolve();
            };
        });
    });

    const loadModelPromise = new Promise(function (resolve, reject) {
        inferEngine
            .startWorker("hand_language-recognition", "3", "rf_F65V1ee5GuTgoTMNhuo1aYHDfzs2")
            .then(function (id) {
                workerId = id;
                console.log("Worker started with ID:", workerId);  // Log worker ID
                resolve();
            })
            .catch(function (error) {
                console.error("Error starting worker:", error);
                reject(error);
            });
    });

    Promise.all([startVideoStreamPromise, loadModelPromise]).then(function () {
        $("body").removeClass("loading");
        resizeCanvas();
        detectFrame();
    });

    var canvas, ctx;
    const font = "16px sans-serif";

    function videoDimensions(video) {
        var videoRatio = video.videoWidth / video.videoHeight;
        var width = video.offsetWidth,
            height = video.offsetHeight;
        var elementRatio = width / height;

        if (elementRatio > videoRatio) {
            width = height * videoRatio;
        } else {
            height = width / videoRatio;
        }

        return {
            width: width,
            height: height
        };
    }

    $(window).resize(function () {
        resizeCanvas();
    });

    const resizeCanvas = function () {
        $("canvas").remove();

        canvas = $("<canvas/>");
        ctx = canvas[0].getContext("2d");

        var dimensions = videoDimensions(video);

        canvas[0].width = video.videoWidth;
        canvas[0].height = video.videoHeight;

        canvas.css({
            width: dimensions.width,
            height: dimensions.height,
            left: ($(window).width() - dimensions.width) / 2,
            top: ($(window).height() - dimensions.height) / 2
        });

        $("body").append(canvas);
    };

    let lastUpdateTime = 0;
    let freezeDuration = 1000; // Fixed freeze for testing

    const renderPredictions = function (predictions) {
        const videoRect = video.getBoundingClientRect();
        const scaleX = videoRect.width / 640;
        const scaleY = videoRect.height / 480;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // Check if there are predictions
        if (predictions.length > 0) {
            const prediction = predictions[0];
            console.log("Prediction found:", prediction);  // Log prediction to check its contents

            // Simple freeze duration of 1 second for testing
            if (Date.now() - lastUpdateTime >= freezeDuration) {
                console.log("Updating result with class:", prediction.class);  // Log the class that is being shown
                document.getElementById("result").textContent = `Detected: ${prediction.class}`;
                ocument.getElementById("result").style.backgroundColor = "rgb(35,33,37)"; // Plain JavaScript update
                lastUpdateTime = Date.now(); // Update last update time
            }

            predictions.forEach(function (prediction) {
                const x = prediction.bbox.x * scaleX;
                const y = prediction.bbox.y * scaleY;
                const width = prediction.bbox.width * scaleX;
                const height = prediction.bbox.height * scaleY;

                ctx.strokeStyle = prediction.color || "#00FF00";
                ctx.lineWidth = 4;
                ctx.strokeRect(x - width / 2, y - height / 2, width, height);

                ctx.fillStyle = prediction.color || "#00FF00";
                const textWidth = ctx.measureText(prediction.class).width;
                const textHeight = parseInt(font, 10);
                ctx.fillRect(x - width / 2, y - height / 2 - textHeight - 4, textWidth + 8, textHeight + 4);
            });
        } else {
            console.log("No predictions found, resetting result.");
            if (Date.now() - lastUpdateTime >= freezeDuration) {  // Simple freeze for testing
                document.getElementById("result").textContent = "Awaiting results..."; // Reset the result
                lastUpdateTime = Date.now();
            }
        }
    };

    let isProcessing = false;
    const detectFrame = function () {
        if (isProcessing || !workerId) {
            requestAnimationFrame(detectFrame);
            return;
        }

        isProcessing = true;

        const image = new CVImage(video);
        inferEngine
            .infer(workerId, image)
            .then(function (predictions) {
                renderPredictions(predictions);
            })
            .catch(function (error) {
                console.error("Error during inference:", error);
            })
            .finally(function () {
                isProcessing = false;
                requestAnimationFrame(detectFrame);
            });
    };
});
