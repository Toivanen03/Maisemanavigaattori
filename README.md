# 🌄 Maisemanavigaattori

**Maisemanavigaattori** on HTML/JavaScript-pohjainen selainprojekti, jossa polygonilaskentaan pohjautuva reittisuodatusalgoritmi tarjoaa kiertotien suorimman reitin sijasta.

## 🎯 Tarkoitus

Tämä projekti on osa Esedun ohjelmistokehityksen opintoja. Projekti toimi keskeneräisenä ohjelmointi-osion näyttötyönä ja sai arvosanaksi **5/5**.

## 🛠️ Teknologiat

- HTML
- CSS
- JavaScript

## 📂 Rakenne

```mermaid
graph TD;
    A[Maisemanavigaattori] --> B[css];
    A --> D[javascript];
    A --> E[mapdata];
    B --> B1[styles.css];
    D --> D1[config.js];
    D --> D2[login.js];
    D --> D3[main.js];
    D --> D4[routeFilter.js];
    D --> D5[utils.js];
    E --> E1[heinola.json];
    E --> E2[vantaa.json];
