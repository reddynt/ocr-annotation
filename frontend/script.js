$(document).ready(() => {
    var entities = [];
    var elements = [];
    var canvasWidth = 640;
    var canvasHeight = 800;
    var entityDefaultColor = "#d3d3d3";
    var imageName = null;
    var selectedEntityElement = null;


    // capture entity radio button update
    function updateSelectedEntityElement(element) {
        selectedEntityElement = element;
    }

    // update entity list
    function updateEntities(entities) {
        // add entities to list
        entities.forEach((e) => {
            $("#entityList").append(
                `<li class="list-group-item">
                <label class="fs-5 text-uppercase" style="color: ${e.colour}" for="${e.name}">${e.name}</label>
                <input id="${e.name}" type="radio" name="entityName" value="${e.name}">
                </li>`
            )
        })
        $("input[id='" + entities[0].name + "']").attr("checked", "checked");
        // capture change in entity selection
        $("input[name='entityName']").on("change", () => {
            updateSelectedEntityElement($("input[name='entityName']:checked"));
        })
    }

    // update elements
    function updateElements(elements) {
        elements = JSON.parse(elements)
        elements.forEach((e) => {
            e["entity"] = null
            e["colour"] = entityDefaultColor
        })
        return elements;
    }

    // draw elements
    function drawElements(elements, imageContext) {
        elements.forEach((e) => {
            imageContext.beginPath();
            imageContext.strokeStyle = e["colour"];
            // if (e["colour"] != entityDefaultColor) {
            // console.log(imageContext.strokeStyle)
            // console.log(e)
            console.log("clicked " + e["entity"] + " " + e["colour"])
            // }
            imageContext.strokeRect(e.left, e.top, e.width, e.height);
            imageContext.closePath();
        })
    }

    $.ajax({
        url: "http://localhost:8000/entitylist",
        type: "GET",
        success: (data) => {
            var response = JSON.stringify(data);
            entities = JSON.parse(response);
            updateEntities(entities);
        },
        error: (msg) => {
            console.log("Failed to get entity list, error message: " + msg)
        }
    })

    // create entity
    $("#createEntity").submit(async (event) => {
        event.preventDefault();
        var formValue = $("#createEntity").serializeArray();
        var entityValue = {
            "name": formValue[0].value.toUpperCase(),
            "colour": formValue[1].value,
        }

        await fetch("http://localhost:8000/createentity", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(entityValue),
        }).then(response => {
            if (response.ok) {
                window.alert("Created entity successfully")
                updateEntities([entityValue])
                $("#createEntity")[0].reset();  // clear input fields on successful entity creation
            } else if (response.status == 404) {
                window.alert("Entity already exists.")
            }
        }).catch(error => {
            console.log(error)
        })
    })

    // create canvas and canvas context
    function createCanvasContext() {
        $("#canvas-container").html(`
            <canvas id="image-canvas" width="640" height="800"></canvas>
        `)
        const imageCanvas = document.getElementById("image-canvas");
        elemLeft = imageCanvas.offsetLeft;
        elemTop = imageCanvas.offsetTop;
        const imageContext = imageCanvas.getContext("2d");
        return [imageCanvas, imageContext]
    }

    // Draw image on canvas when user uploads image
    $("#imageUploadButton").on("change", (event) => {
        let imageFile = event.target.files[0]
        imageName = imageFile.name;
        var reader = new FileReader()
        reader.readAsDataURL(imageFile)
        reader.onload = e => {
            var image = new Image();
            image.src = e.target.result;
            image.onload = () => {
                const [imageCanvas, imageContext] = createCanvasContext();
                imageContext.drawImage(image, 0, 0, canvasWidth, canvasHeight);

                // send image & receive tesseract output
                fetch("http://localhost:8000/getboxes", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ image: imageCanvas.toDataURL(`image/{$imageFile.name.split(".").pop()}`) })
                }).then(async (response) => {
                    if (response.ok) {
                        let content = await response.json();
                        elements = updateElements(content);
                        // draw elements on the canvas
                        drawElements(elements, imageContext);
                    }
                }).catch(error => {
                    console.log(error)
                })

                imageCanvas.addEventListener("click", (event) => {
                    var xVal = event.pageX - elemLeft;
                    var yVal = event.pageY - elemTop;
                    elements.forEach((e) => {
                        if (yVal > e.top && yVal < e.top + e.height && xVal > e.left && xVal < e.left + e.width) {
                            if (e["colour"] != entityDefaultColor) {
                                // toggle element color if clicked twice
                                e["colour"] = entityDefaultColor
                            } else {
                                // update element with entity colour
                                let selectedEntity = selectedEntityElement;
                                let selectedEntityId = selectedEntity.attr("id");
                                let selectedEntityColor = $("label[for='" + selectedEntityId + "']").css('color')
                                e["entity"] = selectedEntity.val();
                                e["colour"] = selectedEntityColor
                            }
                        }
                    })
                    // clear & redraw
                    imageContext.clearRect(0, 0, canvasWidth, canvasHeight)
                    imageContext.drawImage(image, 0, 0, canvasWidth, canvasHeight);
                    drawElements(elements, imageContext)
                })
            }
        }
    })

    // submit save with serialized boxes clicked
    $("#saveAnnotations").on("click", async (event) => {
        event.preventDefault();
        await fetch("http://localhost:8000/save", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ "imageName": imageName, "entities": elements }),
        }).then(response => {
            if (response.ok) {
                window.alert("Successfully saved annotations")
            }
        }).catch(error => {
            console.log(error)
        })
    })
})
