function emailSuccessFunction(returnData) {
    document.querySelector('#enter-email-form').style.display = 'none';
    document.querySelector('#email-submitted-box').style.display = 'block';
    console.log(returnData);
}

document.querySelector('#enter-email-form').onsubmit = function(e) {
    e.preventDefault();
    const userEmail = document.querySelector('#email-input').value;
    if (userEmail.trim() !== '') {
        axiosPost(
            postUrl = '/',
            postData = JSON.stringify({user_email: userEmail}),
            successFunction = emailSuccessFunction
        );
    }
}