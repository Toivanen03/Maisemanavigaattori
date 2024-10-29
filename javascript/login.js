// Pyykkönen
// Käyttäjän kirjautumista ja mahdollista erillistä valikkoa kirjautuneelle käyttäjälle
console.log('Tunnukset = placeholder');

// Muuttujat
const loginForm = document.getElementById('login-form');
const loginFormElement = document.getElementById('login-form-element');
const loginIconDiv = document.getElementById('login-icon');
const loginImage = loginIconDiv.querySelector('img')
const notification = document.getElementById('notification');
const usernameDisplay = document.getElementById('username-display');
const settingsMenu = document.getElementById('settings-menu');
const settingsList = document.getElementById('settings-list');
const settingsIcon = document.getElementById('settings');
const searchDiv = document.querySelector('.search');
const toggleInfo = document.getElementById('toggle-info');
const infoDiv = document.getElementById('info');


// Kirjautuminen ikonista
loginIconDiv.addEventListener('click', function() {
  document.getElementById('login-form').classList.toggle('hide');
  
  // Jos searchDiv näkyvissä
  if (!searchDiv.classList.contains('hide')) {
      searchDiv.classList.add('hide');
  }
  // Jos infoDiv näkyvissä
  if (!infoDiv.classList.contains('hide')) {
    infoDiv.classList.add('hide');
}
});

// Muutama testikäyttäjä
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


// Napataan inputtien arvot ja kirjautumislogiikka. Kirjautuminen siis login-kuvakkeesta
// ja onnistuneen kirjautumisen login muuttuu logoutiksi. Myös settings-kuvake on näkyvillä vain kirjautuneena.
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
    usernameDisplay.innerHTML = `Kirjautuneena: ${user.name} ${user.lastName}<br>Rooli: ${user.role}`;
    usernameDisplay.classList.remove('hide');
    document.getElementById('settings').style.display = 'flex';
    // Asetusvalikko näkyviin käyttäjän roolin mukaan
    displaySettingsMenu(user.role);
} else {
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
// Toggle asetus-kuvakkeelle
document.getElementById('settings').addEventListener('click', function() {
  settingsMenu.classList.toggle('hide');
});

// Uloskirjausta
loginImage.addEventListener('click', function() {
  if (loginImage.alt === 'logout') {
      loginImage.src = 'images/login.png';
      loginImage.alt = 'login';
      loginForm.classList.remove('hide');
      usernameDisplay.classList.add('hide');
      console.log('Kirjauduttiin ulos?');
      usernameDisplay.textContent = '';
      settingsMenu.classList.add('hide');
      settingsIcon.style.display = 'none';
  }
});

// Suljetaan login-form jos klikataan sen ulkopuolella
document.addEventListener('click', function(event) {
  const isClickInsideForm = loginForm.contains(event.target);
  const isClickInsideImage = loginImage.contains(event.target);

  if (!isClickInsideForm && !isClickInsideImage && !loginForm.classList.contains('hide')) {
      loginFormElement.reset();
      loginForm.classList.add('hide');
  }
});


// Tässä luodaan asetusvalikot kirjautuneelle käyttäjälle, roolin mukaan
function displaySettingsMenu(role) {
  settingsList.innerHTML = '';
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Poistu';
  closeButton.style.marginTop = '10px';
  closeButton.addEventListener('click', function() {
    settingsMenu.classList.add('hide');
  });

  // Kaikelle yhteiset asetukset
  const commonSettings = [
    'Muokkaa profiilia',
    'Vaihda salasana',
    'Omat reitit',
    'Tuki'
  ];

 
  commonSettings.forEach(setting => {
    const li = document.createElement('li');
    li.textContent = setting;
    settingsList.appendChild(li);
  });

  // Adminille enemmän asetuksia
  if (role === 'Admin') {
    const adminSettings = [
      'Käyttäjähallinta',
      'Raportit',
      'Asetukset'
    ];
    
    adminSettings.forEach(setting => {
      const li = document.createElement('li');
      li.textContent = setting;
      settingsList.appendChild(li);
    });
  }

  
  settingsList.appendChild(closeButton);
  settingsMenu.classList.remove('hide');
}

