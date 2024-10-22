const loginForm = document.getElementById('login-form');
const loginFormElement = document.getElementById('login-form-element');
const loginDiv = document.getElementById('login');
const loginImage = loginDiv.querySelector('img');

document.getElementById('login').addEventListener('click', function() {
    document.getElementById('login-form').classList.toggle('hide');
});

const User = {
    correctUsername: 'admin',
    correctPassword: 'pass',
    role: 'Admin',
};

loginFormElement.addEventListener('submit', function(event) {
  event.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  if (username === User.correctUsername && password === User.correctPassword) {
    loginForm.classList.add('hide');
    loginImage.src = 'images/logout.png';
    loginImage.alt = 'logout';
    loginFormElement.reset();
    document.getElementById('notification').textContent = '';
    console.log(`Kirjautuneena: ${User.correctUsername}, Salasana: ${User.correctPassword}`);
    console.log(`Käyttäjän rooli: ${User.role}`);
} else {
    loginForm.classList.remove('flash');
    loginForm.classList.add('flash');
    const notification = document.getElementById('notification');
    notification.textContent = 'Wrong username or password!';
    loginFormElement.reset();
   

    setTimeout(() => {
      notification.textContent = '';
  }, 2000);

    setTimeout(() => {
        loginForm.classList.remove('flash');
    }, 1000);
}
});

loginImage.addEventListener('click', function() {
  if (loginImage.alt === 'logout') {
      loginImage.src = 'images/login.png';
      loginImage.alt = 'login';
      loginForm.classList.remove('hide');
      console.log('Kirjauduttiin ulos?');
  }
});

document.addEventListener('click', function(event) {
  const isClickInsideForm = loginForm.contains(event.target);
  const isClickInsideImage = loginImage.contains(event.target);

  if (!isClickInsideForm && !isClickInsideImage && !loginForm.classList.contains('hide')) {
      loginFormElement.reset();
      loginForm.classList.add('hide');
  }
});

