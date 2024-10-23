// Pyykkönen
// Käyttäjän kirjautumista ja mahdollista erillistä valikkoa kirjautuneelle käyttäjälle
console.log('Tunnukset = placeholder');
const loginForm = document.getElementById('login-form');
const loginFormElement = document.getElementById('login-form-element');
const loginDiv = document.getElementById('login');
const loginImage = loginDiv.querySelector('img');
const notification = document.getElementById('notification');
const usernameDisplay = document.getElementById('username-display');

document.getElementById('login').addEventListener('click', function() {
    document.getElementById('login-form').classList.toggle('hide');
});

const users = [
  {
    username: 'admin',
    password: 'pass',
    name: 'Pekka',
    lastName: 'Puupää',
    role: 'Admin'
  },
  {
    username: 'user1',
    password: 'pass1',
    name: 'Seppo',
    lastName: 'Taalasmaa',
    role: 'User'
  },
  {
    username: 'user2',
    password: 'pass2',
    name: 'Ismo',
    lastName: 'Laitela',
    role: 'User'
  }
];

loginFormElement.addEventListener('submit', function(event) {
  event.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const user = users.find(u => u.username === username && u.password === password);

  if (user) {
    loginForm.classList.add('hide');
    loginImage.src = 'images/logout.png';
    loginImage.alt = 'logout';
    loginFormElement.reset();
    notification.textContent = '';
    console.log(`Kirjautuneena: ${user.name} ${user.lastName}`);
    console.log(`Käyttäjän rooli: ${user.role}`);
    usernameDisplay.textContent = `Kirjautuneena: ${user.name} ${user.lastName}`;
    usernameDisplay.classList.remove('hide');
} else {
    loginForm.classList.remove('flash');
    loginForm.classList.add('flash');
    notification.textContent = 'Väärä käyttäjätunnus tai salasana!';
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
      usernameDisplay.classList.add('hide');
      console.log('Kirjauduttiin ulos?');
      usernameDisplay.textContent = '';
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
