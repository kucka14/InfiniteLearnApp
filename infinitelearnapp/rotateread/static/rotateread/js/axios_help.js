function placeLoadingBlock(visibleDelay=true) {
    const blockDiv = document.createElement('div');
    blockDiv.style.position = 'fixed';
    blockDiv.style.left = 0;
    blockDiv.style.right = 0;
    blockDiv.style.top = 0;
    blockDiv.style.bottom = 0;
    blockDiv.style.opacity = '0.5';
    blockDiv.style.display = 'flex';
    blockDiv.style.alignItems = 'center';
    blockDiv.style.justifyContent = 'center';
    blockDiv.id = 'loading-block-div';
    blockDiv.style.zIndex = '10001';
    document.body.appendChild(blockDiv);
    if (visibleDelay) {
        setTimeout(function() {
            blockDiv.style.backgroundColor = 'gray';
            blockDiv.innerHTML = `
                <div class="spinner-grow" style="color: green; width: 25%; height: 25%;"></div>
            `;
        }, 1000);
    } else {
        blockDiv.style.backgroundColor = 'gray';
        blockDiv.innerHTML = `
            <div class="spinner-grow" style="color: green; width: 25%; height: 25%;"></div>
        `;
    }
}

function removeLoadingBlock() {
    const loadingBlockDiv = document.querySelector('#loading-block-div');
    if (loadingBlockDiv !== null) {
        if (loadingBlockDiv.style.backgroundColor !== 'gray') {
            document.body.removeChild(loadingBlockDiv);
        } else {
            setTimeout(function() {
                document.body.removeChild(loadingBlockDiv);
            }, 1000);
        }
    }
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function axiosPost(postUrl, postData, successFunction='', blockActions=true) {
    if (blockActions) {
        placeLoadingBlock();
    }
    axios.post(
        postUrl,
        postData,
        {
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            }
        }
    )
    .then(response => {
        if (blockActions) {
            removeLoadingBlock();
        }
        const rdata = response.data;
        successFunction(rdata['return_data']);
    })
    .catch(error => {
        if (blockActions) {
            removeLoadingBlock();
        }
        // alert('An error occurred.');
        console.log(error);
    })
}