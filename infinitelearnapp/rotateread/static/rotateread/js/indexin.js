// js for the side panel sliding in and out

var sidePanel = document.querySelector('#side-panel');
var panelWidth = sidePanel.offsetWidth;
var edgeThreshold = 50; // Distance from the edge in pixels to trigger the panel

document.addEventListener('mousemove', function(event) {
    if (event.clientX <= edgeThreshold) {
        openPanel();
    } else if (event.clientX > panelWidth) {
        closePanel();
    }
});

function openPanel() {
    sidePanel.style.left = '0';
}

function closePanel() {
    sidePanel.style.left = '-' + panelWidth + 'px';
}

// js for drag and drop list on the side panel

const resourceList = document.getElementById('resource-list');
let draggingElement = null;

resourceList.addEventListener('dragstart', function(event) {
    draggingElement = event.target;
    event.target.classList.add('dragging');
});

resourceList.addEventListener('dragend', function(event) {
    event.target.classList.remove('dragging');
    draggingElement = null;
});

resourceList.addEventListener('dragover', function(event) {
    event.preventDefault();
    const afterElement = getDragAfterElement(resourceList, event.clientY);
    if (afterElement == null) {
        resourceList.appendChild(draggingElement);
    } else {
        resourceList.insertBefore(draggingElement, afterElement);
    }
});

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.draggable-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// js for duplicating list items in the resource list

const contextMenu = document.getElementById('context-menu');
let targetDiv = null;

document.addEventListener('contextmenu', function(event) {
    event.preventDefault();
    if (event.target.classList.contains('duplicable-div')) {
        targetDiv = event.target;
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${event.pageX}px`;
        contextMenu.style.top = `${event.pageY}px`;
    } else {
        contextMenu.style.display = 'none';
    }
});

document.addEventListener('click', function(event) {
    if (event.target.id === 'duplicate' && targetDiv) {
        duplicateDiv(targetDiv);
        contextMenu.style.display = 'none';
    } else if (event.target.id === 'remove' && targetDiv) {
        removeDiv(targetDiv);
        contextMenu.style.display = 'none';
    } else if (!contextMenu.contains(event.target)) {
        contextMenu.style.display = 'none';
    }
});

function duplicateDiv(div) {
    const clone = div.cloneNode(true);
    clone.style.backgroundColor = 'white';
    div.parentNode.insertBefore(clone, div.nextSibling);
}

function removeDiv(div) {
    if (div.style.backgroundColor !== 'yellow') {
        div.parentNode.removeChild(div);
    }
}

// js that controls the flow through learn items

let currentItem = null;
let rotateTimeout1 = null;
let rotateTimeout2 = null;
let rotateTimeout3 = null;
let learnItemStatus = null;
let learnItemBookmark = null;
let learnItemOther = null;
let scrollInterval = null;
let textDisplayTimeout = null;
let charTimeout = null;
let readWordTimeout = null;
let jumpTextTimeout = null;
let learnItemName = null;

function activateLearnItem(element) {
    clearTimeout(rotateTimeout1);
    clearTimeout(rotateTimeout2);
    clearTimeout(rotateTimeout3);
    document.querySelectorAll('.draggable-item').forEach(function(div) {
        div.style.backgroundColor = 'white';
    });
    element.style.backgroundColor = 'yellow';
    currentItem = element;
    learnItemName = element.innerHTML;
    executeLearnItem();
}

document.addEventListener('dblclick', function(event) {
    if (event.target.classList.contains('draggable-item')) {
        if (rotateTimeout1 !== null) {
            clearDisplayLearn();
        }
        activateLearnItem(event.target);
    }
});

function displayLearnItemSuccess(returnData) {
    const displayType = returnData['display_type'];
    const resourceText = returnData['resource_text'];
    console.log(displayType);
    if (displayType === 'fastread') {
        fastreadSet(resourceText);
    } else if (displayType === 'genread') {
        genreadSet(resourceText);
    } else if (displayType === 'video') {
        videoSet(resourceText);
    } else if (displayType === 'translate') {
        const translationChunks = returnData['translation_chunks'];
        genreadSet(resourceText, translationChunks);
    }
}

function displayLearnItem(learnItemName) {
    axiosPost(
        postUrl = '/',
        postData = JSON.stringify({learn_item_name: learnItemName}),
        successFunction = displayLearnItemSuccess
    );
}

function displayAIExamples(contextText) {
    console.log('AIExamples');
}

function displayAIQuestions(contextText) {
    console.log('AIQuestions');
}

function executeLearnItem() {
    learnItemStatus = JSON.parse(localStorage.getItem(learnItemName + 'status'));
    if (learnItemStatus === null) {
        learnItemStatus = [null, null];
    }
    learnItemBookmark = learnItemStatus[0];
    learnItemOther = learnItemStatus[1];
    
    const contextText = displayLearnItem(learnItemName);
    rotateTimeout1 = setTimeout(function() {
        rotateTimeout1 = null;
        clearDisplayLearn();
        displayAIExamples(contextText);
        rotateTimeout2 = setTimeout(function() {
            document.querySelector('#learn-container').innerHTML = '';
            displayAIQuestions(contextText);
            rotateTimeout3 = setTimeout(function() {
                document.querySelector('#learn-container').innerHTML = '';
                let nextItem = currentItem.nextElementSibling;
                if (nextItem === null) {
                    nextItem = document.querySelector('.draggable-item');
                }
                activateLearnItem(nextItem);
            }, 60000);
        }, 60000);
    }, 60000);

    
}

function fastreadSet(resourceText) {
    const insertHTML = `
        <style>
            #full-container {
                background-color: DarkSlateGray;
                position: absolute;
                height: 100vh;
                width: 100vw;
                top: 0;
                left: 0;
            }

            #book-container {
                width: 90%;
                height: 100%;
                overflow-y: hidden;
                margin-left: auto;
                margin-right: auto;
            }

            #images-container {
                position: relative;
            }

            #page-image {
                width: 100%;
            }
        </style>

        <div id="full-container">
            <div id="book-container">
                <div id="images-container" style="margin-top: 0px;">
                    ${resourceText}
                </div>
            </div>
        </div>
    `;
    document.querySelector('#learn-container').innerHTML = insertHTML;

    let bookHeight;
    let marginTop = 0;
    let paused = false;
    let readIntervalLength = 50;

    function getRndInteger(min, max) {
        return Math.floor(Math.random() * (max - min + 1) ) + min;
    }

    function setScrollSpeed(pixelJump, intervalLength) {
        clearInterval(scrollInterval);
        scrollInterval = setInterval(function() {
            marginTop -= pixelJump;
            document.querySelector('#images-container').style.marginTop = marginTop + 'px';
        }, intervalLength);
    }

    document.onkeydown = function(e) {
        if (e.repeat) return;
        if (e.keyCode === 40) {
            setScrollSpeed(10, 10);
        } else if (e.keyCode === 38) {
            setScrollSpeed(-10, 10);
        }
    };

    document.onkeyup = function(e) {
        if (e.keyCode === 40 | e.keyCode === 38) {
            setScrollSpeed(1, readIntervalLength);
        } else if (e.keyCode === 32) {
            learnItemBookmark = marginTop;
            if (paused) {
                setScrollSpeed(1, readIntervalLength);
                paused = false;
            } else {
                clearInterval(scrollInterval);
                paused = true;
            }
        }
    }

    bookHeight = document.querySelector('#images-container').clientHeight;
    setTimeout(function() {
        marginTop = learnItemBookmark;
        if (marginTop !== null) {
            marginTop = parseInt(marginTop);
        } else {
            marginTop = 0;
        }
        setScrollSpeed(1, readIntervalLength);
    });
}

function genreadSet(resourceText, translationChunks=null) {
    let translateCSS = '';
    if (translationChunks !== null) {
        translateCSS = 'display: flex;justify-content: center;align-items: center;max-width: 650px;';
    }
    const insertHTML = `
        <style>
            body {
                color: black;
                background-color: whitesmoke;
            }

            #main-div {
                width: 100vw;
                height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
            }

            #text-holder-div {
                width: calc(100% - 40px);
                max-width: 650px;
                height: 45vh;
                min-height: 150px;
                position: relative;
                display: flex;
            }

            #text-display-div {
                position: absolute;
                top: 10px;
                width: 100%;
                height: 40px;
                background-color: red;
                z-index: 1;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 15px;
            }

            #text-fade-div {
                position: absolute;
                width: 100%;
                height: 100%;
                background: linear-gradient(to top, rgba(245,245,245,0), rgba(245,245,245,0) 30%, rgba(245,245,245,1) 70%, whitesmoke);
            }

            #text-div {
                align-self: flex-end;
                padding: 15px;
                word-break: break-all;
            }

            .input-span {
                display: inline-block;
                border-radius: 2px;
            }

            #image-div {
                height: calc(55vh - 10px);
                width: calc(100vw - 20px);
                overflow: scroll;
                ${translateCSS}
            }
        </style>

        <div id="main-div">
            <div id="text-holder-div">
                <div style="display: none;" id="text-display-div"></div>
                <div id="text-fade-div"></div>
                <div id="text-div"></div>
            </div>
            <div id="image-div"></div>
        </div>
    `;
    document.querySelector('#learn-container').innerHTML = insertHTML;

    const normalChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' ";
    const bookText = resourceText;
    const bookTextList = bookText.split(' ');
    while (bookTextList.includes('')) {
        bookTextList.splice(bookTextList.indexOf(''), 1);
    }
    const textDiv = document.querySelector('#text-div');
    const textDisplayDiv = document.querySelector('#text-display-div');
    const imageDiv = document.querySelector('#image-div');
    if (learnItemBookmark === null) {
        learnItemBookmark = 0;
    } else {
        learnItemBookmark = parseInt(learnItemBookmark);
    }
    let running = false;
    let averageWordLength = bookTextList.join(' ').length /  bookTextList.length
    let wordsPerMinuteArray = [25, 50, 75, 100, 125, 150, 175, 200, 250, 300, 350, 400, 450, 500];
    let delayArray = [];
    for (let i = 0; i < wordsPerMinuteArray.length; i++) {
        let wordsPerMinute = wordsPerMinuteArray[i];
        let totalMinutes = bookTextList.length / wordsPerMinute;
        let minutesPerChar = totalMinutes / bookTextList.join('').length;
        let delay = (minutesPerChar * 60000) / 2;
        delayArray.push(delay);
    }
    let delay = delayArray[0];
    let blankNumber = 3;

    function changeSpeed(direction) {
        clearTimeout(textDisplayTimeout);
        let delayArrayIndex = delayArray.indexOf(delay);
        let newIndex = delayArrayIndex + direction;
        if (newIndex < 0) {
            newIndex = 0;
        } else if (newIndex >= delayArray.length) {
            newIndex = delayArray.length - 1;
        }
        delay = delayArray[newIndex];
        let wordsPerMinute = wordsPerMinuteArray[newIndex];
        textDisplayDiv.innerHTML = wordsPerMinute + ' words per minute';
        textDisplayDiv.style.display = 'flex';
        textDisplayTimeout = setTimeout(function() {
            textDisplayDiv.style.display = 'none';
            textDisplayDiv.innerHTML = '';
        }, 1000);
    }

    function placeTextChunk(startIndex, endIndex) {
        if (startIndex < 0) {
            startIndex = 0;
        }
        if (endIndex >= bookTextList.length) {
            endIndex = bookTextList.length - 1;
        }
        let placeText = '';
        for (let i = startIndex; i < endIndex; i++) {
            let word = bookTextList[i];
            word = word.replaceAll('\n', '<br>');
            placeText += word;
            placeText += ' ';
        }
        textDiv.innerHTML = placeText;
    }

    function addWord(target, word, delay, acceptInput, callback) {
        let charIndex = 0;
        function addChar() {
            if (!running) {
                return;
            }
            if (word[charIndex] === '\n') {
                target.innerHTML += '<br>';
            } else {
                target.innerHTML += word[charIndex];
            }
            charIndex++;
            if (charIndex < word.length) {
                if (acceptInput && !normalChars.includes(word[charIndex])) {
                    addChar();
                } else {
                    charTimeout = setTimeout(function() {
                        addChar();
                    }, delay);
                    if (acceptInput) {
                        document.onkeydown = function(e) {
                            if (e.key === word[charIndex]) {
                                clearTimeout(charTimeout);
                                addChar();
                            }
                        }
                    }
                }
            } else {
                if (acceptInput) {
                    document.onkeydown = function(e) {
                        if (e.key === ' ') {
                            document.onkeydown = null;
                            target.style.color = 'black';
                            target.style.backgroundColor = 'white';
                            target.style.paddingLeft = '0';
                            target.style.paddingRight = '0';
                            target.style.width = (target.clientWidth - 8) + 'px';
                            textDiv.innerHTML += ' ';
                            callback();
                        }
                    }
                } else {
                    target.innerHTML += ' ';
                    callback();
                }
            }
        }
        addChar();
    }

    function filterWord(word) {

        let letterCount = 0;
        for (let i = 0; i < word.length; i++) {
            if (normalChars.includes(word[i])) {
                letterCount++;
            }
        }

        let randomCutoff = null;
        let minLength = 5;
        if (blankNumber % 2 === 0) {
            randomCutoff = blankNumber / 20;
        } else {
            randomCutoff = (blankNumber+1) / 20;
            minLength = 0;
        }
        if (blankNumber === 8 || blankNumber === 9) {
            randomCutoff = 0.8;
        }

        if ((letterCount >= minLength) && (Math.random() < randomCutoff) && !(word.includes('\n')) && !(word.slice(0) === '`')) {
            return true;
        } else {
            return false;
        }
    }

    function readText() {
        let target = null;
        let word = null;
        let acceptInput = false;
        function readWord() {
            if (!running || learnItemBookmark >= bookTextList.length) {
                return;
            }
            word = bookTextList[learnItemBookmark];

            if ((word.split('-')[0] === 'd1ec9124e9c00620256ed5ee6bf66c28')) {
                if (translationChunks !== null) {
                    const translationIndex = word.split('-translation')[1];
                    imageDiv.innerHTML = translationChunks[translationIndex];
                    word = ' ';
                } else {
                    const image_filename = word.split('-')[1];
                    const image_html = `<img style="width: 100%;" src="/media/genread_images/${image_filename}"><hr>`;
                    imageDiv.innerHTML += image_html;
                }
            } else if (word === 'ad9b98955921d47b6ad91e92b6fe7634') {
                imageDiv.innerHTML = '';
                word = ' ';
            }

            let charDelay = delay;
            let wordDelay = delay;
            if (filterWord(word)) {
                charDelay = 1000;
                acceptInput = true;
                textDiv.innerHTML += `<span class="input-span" style="color: white; background-color: darkslategray; visibility: hidden; padding-left: 3px; padding-right: 3px;">${word}</span>`;
                target = textDiv.lastChild;
                let width = target.clientWidth + 3;
                target.innerHTML = '';
                target.style.width = width + 'px';
                target.style.visibility = 'visible';
            } else {
                word = word.replaceAll('`', '');
                acceptInput = false;
                target = textDiv;
            }
            addWord(target, word, charDelay, acceptInput, function() {
                learnItemBookmark++;
                readWordTimeout = setTimeout(function() {
                    readWord();
                }, wordDelay);
            });
        }
        readWord();
    }

    function jumpText(jumpAmount) {
        let originalRunning = running;
        running = false;
        jumpTextTimeout = setTimeout(function() {
            learnItemBookmark += jumpAmount;
            if (learnItemBookmark < 0) {
                learnItemBookmark = 0;
            } else if (learnItemBookmark >= bookTextList.length) {
                learnItemBookmark = bookTextList.length - 1;
            }
            placeTextChunk(learnItemBookmark - 1000, learnItemBookmark);
            if (originalRunning) {
                running = true;
                readText();
            }
        }, 200);
    }

    function placeProgressBanner() {
        let percentComplete = Math.round((learnItemBookmark / bookTextList.length)*100) + '%';
        let wordsPerMinuteArrayIndex = delayArray.indexOf(delay);
        let wordsPerMinute = wordsPerMinuteArray[wordsPerMinuteArrayIndex] + 'wpm';
        progressText = `<div>${percentComplete}</div><div>${wordsPerMinute}</div><div><u>${blankNumber}</u></div>`;
        textDisplayDiv.innerHTML = progressText;
        textDisplayDiv.style.display = 'flex';
    }

    document.onkeyup = function(e) {
        if (e.key === 'Enter') {
            if (running === true) {
                placeProgressBanner();
                running = false;
                placeTextChunk(learnItemBookmark - 1000, learnItemBookmark);
            } else {
                textDisplayDiv.style.display = 'none';
                textDisplayDiv.innerHTML = '';
                running = true;
                readText();
            }
        } else if (e.key === 'ArrowLeft') {
            jumpText(-500);
            imageDiv.innerHTML = '';
        } else if (e.key === 'ArrowRight') {
            jumpText(500);
            imageDiv.innerHTML = '';
        } else if (e.key === 'ArrowDown') {
            changeSpeed(1);
        } else if (e.key === 'ArrowUp') {
            changeSpeed(-1);
        } else if ('0123456789'.includes(e.key)) {
            blankNumber = parseInt(e.key);
            textDisplayDiv.innerHTML = 'Blank Level: ' + blankNumber;
            textDisplayDiv.style.display = 'flex';
            textDisplayTimeout = setTimeout(function() {
                textDisplayDiv.style.display = 'none';
                textDisplayDiv.innerHTML = '';
            }, 1000);
        }
    }

    placeTextChunk(learnItemBookmark - 1000, learnItemBookmark);
}

function videoSet(resourceText) {
    const insertHTML = `
        <video width="640" height="360" controls>
            <source src="${resourceText}" type="video/mp4">
            Your browser does not support the video tag.
        </video>
    `;
    document.querySelector('#learn-container').innerHTML = insertHTML;
}

function clearDisplayLearn() {
    document.querySelector('#learn-container').innerHTML = '';
    document.onkeydown = null;
    document.onkeyup = null;
    window.onload = null;
    clearInterval(scrollInterval);
    clearTimeout(textDisplayTimeout);
    clearTimeout(charTimeout);
    clearTimeout(readWordTimeout);
    clearTimeout(jumpTextTimeout);
    learnItemStatus[0] = learnItemBookmark;
    learnItemStatus[1] = learnItemOther;
    localStorage.setItem(learnItemName + 'status', JSON.stringify(learnItemStatus));
}
