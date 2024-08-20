///////////////////////////////////////////
// js for the side panel sliding in and out
///////////////////////////////////////////

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

/////////////////////////////////////////////////////////
// variables that are used throughout the below functions
/////////////////////////////////////////////////////////

let currentResource = null;
let rotateTimeout1 = null;
let rotateTimeout2 = null;
let rotateTimeout3 = null;
let resourceBookmark = null;
let resourceStorage = null;
let aiReview = false;
let contextText = '';

let scrollInterval = null;
let textDisplayTimeout = null;
let charTimeout = null;
let readWordTimeout = null;
let jumpTextTimeout = null;

let resourceCache = {};

//////////////////////////////////////////////
// js for drag and drop list on the side panel
//////////////////////////////////////////////

const resourceList = document.getElementById('resource-list');
let draggingElement = null;

function saveResourceList() {
    let inputArray = [];
    const inputs = document.querySelectorAll('input');
    for (let i = 0; i < inputs.length; i++) {
        inputArray.push(inputs[i].value);
    }
    localStorage.setItem('resourceListInputs', JSON.stringify(inputArray));
    localStorage.setItem('resourceListInnerHTML', JSON.stringify(resourceList.innerHTML));
}

let resourceListInnerHTML = localStorage.getItem('resourceListInnerHTML');
if (resourceListInnerHTML !== null) {
    resourceList.innerHTML = JSON.parse(resourceListInnerHTML);
    const learnItems = document.querySelectorAll('.draggable-item');
    let targetLearnItem = null;
    for (let i = 0; i < learnItems.length; i++) {
        if (learnItems[i].style.backgroundColor === 'yellow') {
            targetLearnItem = learnItems[i].firstElementChild;
            break;
        }
    }
    if (targetLearnItem !== null) {
        setTimeout(function() {
            activateResource(targetLearnItem);
        });
    }
}
if (localStorage.getItem('resourceListInputs') !== null) {
    const resourceListInputs = JSON.parse(localStorage.getItem('resourceListInputs'));
    const inputs = document.querySelectorAll('input');
    for (let i = 0; i < inputs.length; i++) {
        inputs[i].value = resourceListInputs[i];
    }
}

document.addEventListener('input', function(event) {
    saveResourceList();
})

document.querySelector('#shuffle-button').onclick = function() {
    // Function to shuffle an array using the Fisher-Yates shuffle algorithm
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    function shuffleDivs(parentDiv) {
        // Convert the child divs to an array
        const divArray = Array.from(parentDiv.children);
        // Shuffle the array
        const shuffledDivs = shuffleArray(divArray);
        // Append the shuffled divs back to the parent div
        shuffledDivs.forEach(div => parentDiv.appendChild(div));
    }
    // Call the shuffleDivs function
    shuffleDivs(resourceList);
    saveResourceList();
}

document.querySelector('#reset-button').onclick = function() {
    localStorage.clear();
    location.reload();
}

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
    saveResourceList();
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

//////////////////////////////////////////////////////////////////
// js for duplicating and removing list items in the resource list
//////////////////////////////////////////////////////////////////

const contextMenu = document.getElementById('context-menu');
let targetDiv = null;

document.addEventListener('contextmenu', function(event) {
    event.preventDefault();
    if (event.target.parentElement.classList.contains('duplicable-div')) {
        targetDiv = event.target.parentElement;
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${event.pageX}px`;
        contextMenu.style.top = `${event.pageY}px`;
    } else {
        contextMenu.style.display = 'none';
    }
    saveResourceList();
});

document.addEventListener('click', function(event) {
    if (event.target.id === 'duplicate' && targetDiv) {
        duplicateDiv(targetDiv);
        contextMenu.style.display = 'none';
        saveResourceList();
    } else if (event.target.id === 'remove' && targetDiv) {
        removeDiv(targetDiv);
        contextMenu.style.display = 'none';
        saveResourceList();
    } else if (event.target.id === 'reset-resource' && targetDiv) {
        localStorage.setItem(targetDiv.innerHTML + '-status', null);
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

////////////////////////////////////////////////
// js that controls the flow through learn items
////////////////////////////////////////////////

document.addEventListener('dblclick', function(event) {
    if (event.target.classList.contains('learn-item-div')) {
        if (rotateTimeout1 !== null) {
            clearResourceDisplay();
        } else {
            document.querySelector('#learn-container').innerHTML = '';
        }
        activateResource(event.target);
    }
});

function activateResource(element) {

    clearTimeout(rotateTimeout1);
    clearTimeout(rotateTimeout2);
    clearTimeout(rotateTimeout3);
    document.querySelectorAll('.draggable-item').forEach(function(div) {
        div.style.backgroundColor = 'white';
    });
    element.parentElement.style.backgroundColor = 'yellow';
    currentResource = element;
    saveResourceList();

    let resourceStatus = JSON.parse(localStorage.getItem(currentResource.innerHTML + '-status'));
    if (resourceStatus === null) {
        resourceStatus = [null, null];
    }
    resourceBookmark = resourceStatus[0];
    resourceStorage = resourceStatus[1];
    
    displayResource(currentResource.innerHTML);
    rotateTimeout1 = setTimeout(function() {
        rotateTimeout1 = null;
        clearResourceDisplay();
        let nextItem = currentResource.parentElement.nextElementSibling.firstElementChild;
        if (nextItem === null) {
            nextItem = document.querySelector('.draggable-item').firstElementChild;
        }
        if (aiReview) {
            displayAIExamples();
            rotateTimeout2 = setTimeout(function() {
                document.querySelector('#learn-container').innerHTML = '';
                displayAIQuestions();
                rotateTimeout3 = setTimeout(function() {
                    document.querySelector('#learn-container').innerHTML = '';
                    document.onkeyup = null;
                    activateResource(nextItem);
                }, parseFloat(currentResource.nextElementSibling.value.split(',')[2].trim())*60*1000);
            }, parseFloat(currentResource.nextElementSibling.value.split(',')[1].trim())*60*1000);
        } else {
            activateResource(nextItem);
        }
    }, parseFloat(currentResource.nextElementSibling.value.split(',')[0].trim())*60*1000);

}

function displayResource(resourceName) {
    if (resourceName in resourceCache) {
        displayResourceSuccessFunction(resourceCache[resourceName]);
    } else {
        axiosPost(
            postUrl = '/',
            postData = JSON.stringify({resource_name: resourceName}),
            successFunction = displayResourceSuccessFunction
        );
    }
}

function displayResourceSuccessFunction(returnData) {
    resourceCache[currentResource.innerHTML] = returnData;
    const displayType = returnData['display_type'];
    const resourceText = returnData['resource_text'];
    if (displayType === 'fastread') {
        contextText = currentResource.innerHTML;
        fastreadSet(resourceText);
        aiReview = false;
    } else if (displayType === 'genread') {
        contextText = resourceText.split(' ').slice(resourceBookmark, resourceBookmark+200);
        genreadSet(resourceText);
        aiReview = true;
    } else if (displayType === 'video') {
        videoSet(resourceText);
        aiReview = false;
    } else if (displayType === 'translate') {
        const translationChunks = returnData['translation_chunks'];
        genreadSet(resourceText, translationChunks);
        aiReview = false;
    }
}

function askAIQuestion(question, target) {
    axiosPost(
        postUrl = 'ee8c78ce53297da92f1fccd7eb5a773a/',
        postData = JSON.stringify({question: question, target: target}),
        successFunction = askAIQuestionSuccessFunction
    );
}

function askAIQuestionSuccessFunction(returnData) {
    const response = returnData['response'];
    const target = returnData['target'];
    document.querySelector('#' + target).innerHTML = response;
}

function displayAIExamples() {
    document.querySelector('#learn-container').innerHTML = `
        <div style="padding: 20px;" id="ai-response-div"></div>
    `;
    const target = 'ai-response-div';
    const question = 'Generate examples about the following topic: ' + contextText;
    askAIQuestion(question, target);
    document.onkeyup = function(e) {
        if (e.key === 'Enter') {
            const question = 'Generate more examples about the same topic.';
            askAIQuestion(question, target);
        }
    }
}

function displayAIQuestions() {
    document.querySelector('#learn-container').innerHTML = `
        <div style="padding: 20px;" id="ai-response-div"></div>
    `;
    const target = 'ai-response-div';
    const question = 'Generate questions and answers about the following topic: ' + contextText;
    askAIQuestion(question, target);
    document.onkeyup = function(e) {
        if (e.key === 'Enter') {
            const question = 'Generate more questions and answers about the same topic.';
            askAIQuestion(question, target);
        }
    }
}

///////////////////////////////////
//js that sets up the fastread page
///////////////////////////////////

function fastreadSet(resourceText) {
    
    const insertHTML = `
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
        if (e.keyCode === 40 || e.keyCode === 38) {
            setScrollSpeed(1, readIntervalLength);
        } else if (e.keyCode === 32) {
            resourceBookmark = marginTop;
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
        marginTop = resourceBookmark;
        if (marginTop !== null) {
            marginTop = parseInt(marginTop);
        } else {
            marginTop = 0;
        }
        setScrollSpeed(1, readIntervalLength);
    });

}

///////////////////////////////////
//js that sets up the genread page
///////////////////////////////////

function genreadSet(resourceText, translationChunks=null) {

    const insertHTML = `
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

    if (translationChunks !== null) {
        const target = document.querySelector('#image-div');
        target.style.display = 'flex';
        target.style.justifyContent = 'center';
        target.style.alignItems = 'center';
        target.style.maxWidth = '650px';
    }

    const normalChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' ";
    const bookText = resourceText;
    const bookTextList = bookText.split(' ');
    while (bookTextList.includes('')) {
        bookTextList.splice(bookTextList.indexOf(''), 1);
    }
    const textDiv = document.querySelector('#text-div');
    const textDisplayDiv = document.querySelector('#text-display-div');
    const imageDiv = document.querySelector('#image-div');
    if (resourceBookmark === null) {
        resourceBookmark = 0;
    } else {
        resourceBookmark = parseInt(resourceBookmark);
    }
    let running = false;
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
            if (!running || resourceBookmark >= bookTextList.length) {
                return;
            }
            word = bookTextList[resourceBookmark];

            if ((word.trim().split('-')[0] === 'd1ec9124e9c00620256ed5ee6bf66c28')) {
                if (translationChunks !== null) {
                    const translationIndex = word.trim().split('-translation')[1];
                    imageDiv.innerHTML = translationChunks[translationIndex];
                } else {
                    const image_filename = word.trim().split('-')[1];
                    const image_html = `<img style="width: 100%;" src="/media/genread_images/${image_filename}"><hr>`;
                    imageDiv.innerHTML += image_html;
                }
                word = ' ';
            } else if (word.trim() === 'ad9b98955921d47b6ad91e92b6fe7634') {
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
                resourceBookmark++;
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
            resourceBookmark += jumpAmount;
            if (resourceBookmark < 0) {
                resourceBookmark = 0;
            } else if (resourceBookmark >= bookTextList.length) {
                resourceBookmark = bookTextList.length - 1;
            }
            placeTextChunk(resourceBookmark - 1000, resourceBookmark);
            if (originalRunning) {
                running = true;
                readText();
            }
        }, 200);
    }

    function placeProgressBanner() {
        let percentComplete = Math.round((resourceBookmark / bookTextList.length)*100) + '%';
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
                placeTextChunk(resourceBookmark - 1000, resourceBookmark);
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

    placeTextChunk(resourceBookmark - 1000, resourceBookmark);
    
}

///////////////////////////////////
//js that sets up the video page
///////////////////////////////////

function videoSet(resourceText) {
    const insertHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100vh; width: 100vw;">
            <video id="video-window" height="90%" controls>
                <source src="${resourceText}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        </div>
    `;
    document.querySelector('#learn-container').innerHTML = insertHTML;

    const vid = document.querySelector("#video-window");

    document.onkeyup = function(e) {
        if (e.key === 'ArrowLeft') {
            vid.playbackRate -= 0.5;
        } else if (e.key === 'ArrowRight') {
            vid.playbackRate += 0.5;
        }
    }
}

//////////////////////////////////////////////////////////
//js that clears everything from the resource display page
//////////////////////////////////////////////////////////

function clearResourceDisplay() {
    document.querySelector('#learn-container').innerHTML = '';
    document.onkeydown = null;
    document.onkeyup = null;
    clearInterval(scrollInterval);
    clearTimeout(textDisplayTimeout);
    clearTimeout(charTimeout);
    clearTimeout(readWordTimeout);
    clearTimeout(jumpTextTimeout);
    const resourceStatus = [resourceBookmark, resourceStorage];
    localStorage.setItem(currentResource.innerHTML + '-status', JSON.stringify(resourceStatus));
}


