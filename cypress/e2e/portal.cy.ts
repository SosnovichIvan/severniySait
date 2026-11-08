describe('Portal and editorial workflow against real API',()=>{
 it('navigates all required sections and searches real division links',()=>{cy.visit('/');cy.contains('h1','Северный');cy.get('nav[aria-label="Основная навигация"]').contains('Подразделения').click();cy.get('[aria-label="Найти город"]').type('Москва');cy.screenshot('division-search-dark-desktop',{capture:'viewport'});cy.get('[aria-label="Включить светлую тему"]').click();cy.get('[aria-label="Найти город"]').focus();cy.screenshot('division-search-light-desktop',{capture:'viewport'});cy.viewport(390,844);cy.get('[aria-label="Найти город"]').clear().type('Москва');cy.screenshot('division-search-light-mobile',{capture:'viewport'});cy.get('[aria-label="Включить тёмную тему"]').click();cy.get('[aria-label="Найти город"]').focus();cy.screenshot('division-search-dark-mobile',{capture:'viewport'});cy.viewport(1280,720);cy.contains('.division-inactive','Москва').should('have.attr','aria-disabled','true').find('a').should('not.exist');cy.get('nav[aria-label="Основная навигация"]').contains('Медиапространство').click();cy.contains('h2','Telegram');cy.contains('h2','MAX');cy.get('nav[aria-label="Основная навигация"]').contains('Календарь событий').click();cy.contains('h1','Календарь событий');cy.get('[aria-label="Следующий месяц"]').click();cy.get('[aria-label="Предыдущий месяц"]').click();cy.get('footer').contains('a','Медиа').click();cy.contains('h1','Медиа');cy.get('footer').contains('a','Подразделения').click();cy.contains('h1','Подразделения');});
 it('supports both themes and mobile menu without horizontal overflow',()=>{cy.viewport(1280,900);cy.visit('/');cy.get('#boot-splash').should('not.exist');cy.get('[aria-label="Включить светлую тему"]').click();cy.get('html').should('have.attr','data-theme','light');cy.screenshot('home-light-desktop',{capture:'fullPage'});cy.reload();cy.get('html').should('have.attr','data-theme','light');cy.get('[aria-label="Включить тёмную тему"]').click();cy.screenshot('home-dark-desktop',{capture:'fullPage'});cy.viewport(390,844);cy.get('[aria-label="Открыть меню"]').click();cy.get('nav[aria-label="Основная навигация"]').contains('Медиа').click();cy.contains('h1','Медиа');cy.get('[aria-label="Открыть меню"]').should('have.attr','aria-expanded','false');cy.visit('/');cy.contains('h1','Северный');cy.get('#boot-splash').should('not.exist');cy.document().then(d=>expect(d.documentElement.scrollWidth).to.be.at.most(390));cy.screenshot('home-dark-mobile',{capture:'fullPage'});cy.get('[aria-label="Включить светлую тему"]').click();cy.screenshot('home-light-mobile',{capture:'fullPage'});cy.viewport(320,740);cy.document().then(d=>expect(d.documentElement.scrollWidth).to.be.at.most(320));cy.get('.header-brand-short').should('be.visible');cy.visit('/media');cy.get('header [aria-label="Северный человек — главная"]').click();cy.location('pathname').should('eq','/');cy.contains('h1','Северный');});
 it('authenticates, creates draft then publishes, edits and deletes event',()=>{cy.visit('/');cy.get('header [aria-label="Войти для редакции"]').click();cy.location('pathname').should('eq','/');cy.get('dialog.login-dialog').should('be.visible');cy.get('input[type=password]').type('e2e-password');cy.get('dialog.login-dialog').contains('button','Войти').click();cy.contains('h1','Редакция');cy.contains('label','Название события').find('input').type('Тестовое событие E2E');cy.contains('label','Город').find('input').type('Москва');cy.get('input[type=datetime-local]').type('2026-11-20T18:00');cy.get('textarea').type('Проверка сквозного сценария');cy.contains('button','Сохранить событие').click();cy.contains('[role=status]','Событие сохранено');cy.request('/api/content').its('body.events').should('have.length',0);cy.contains('article','Тестовое событие E2E').find('[aria-label^="Редактировать"]').click();cy.contains('label','Опубликовать на сайте').find('input').check();cy.contains('button','Сохранить событие').click();cy.request('/api/content').its('body.events.0.title').should('eq','Тестовое событие E2E');cy.screenshot('admin-events',{capture:'fullPage'});cy.contains('article','Тестовое событие E2E').find('[aria-label^="Удалить"]').click();cy.get('[role=alertdialog]').contains('button','Удалить').click();cy.contains('[role=status]','Запись удалена');cy.request('/api/content').its('body.events').should('have.length',0);});
 it('uploads real image, publishes and removes it; rejects unauthorized writes',()=>{cy.visit('/admin');cy.get('input[type=password]').type('e2e-password');cy.get('dialog.login-dialog').contains('button','Войти').click();cy.contains('button','Медиа').click();cy.contains('label','Название материала').find('input').type('Медиа E2E');cy.get('input[name=eventDate]').type('2022-12-25');cy.get('input[type=file]').selectFile({contents:Cypress.Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1kAAAAASUVORK5CYII=','base64'),fileName:'photo.png',mimeType:'image/png'});cy.contains('label','Опубликовать на сайте').find('input').check();cy.contains('button','Сохранить материал').click();cy.contains('[role=status]','Материал сохранён');cy.request('/api/content').its('body.media.0.title').should('eq','Медиа E2E');cy.request('/api/content').its('body.media.0.eventDate').should('eq','2022-12-25');cy.visit('/media');cy.get('[role=combobox][aria-labelledby]').filter((_,e)=>e.closest('.select-field')!.textContent!.includes('Год')).click();cy.get('[role=option]').contains('2022').click();cy.get('.select-field').contains('label','Порядок').parent().find('[role=combobox]').click();cy.get('[role=option]').contains('Сначала новые').click();cy.get('img[alt="Медиа E2E"]').should('be.visible').and($img=>expect(($img[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0));cy.visit('/admin');cy.contains('button','Медиа').click();cy.contains('article','Медиа E2E').find('[aria-label^="Удалить"]').click();cy.get('[role=alertdialog]').contains('button','Удалить').click();cy.contains('[role=status]','Запись удалена');cy.contains('button','Выйти').click();cy.contains('h2','Вход в админку');cy.request({url:'/api/admin/content',failOnStatusCode:false}).its('status').should('eq',401);cy.request({url:'/api/admin/events',method:'POST',body:{title:'bad'},failOnStatusCode:false}).its('status').should('eq',403);});
});

describe("Logo, loading and current date",()=>{it("shows the supplied emblem while content loads and renders the founder biography",()=>{cy.intercept("GET","/api/content",req=>{req.on("response",res=>res.setDelay(1800));}).as("bootstrap");cy.visit("/");cy.get("#boot-splash").should("be.visible");cy.get("#boot-splash img").should("be.visible").and($img=>expect(($img[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0));cy.screenshot("loading-logo");cy.wait("@bootstrap");cy.get("#boot-splash").should("not.exist");cy.get(".brand-logo").should("be.visible");cy.contains("h3","Михаил");cy.contains("Михаил Фёдорович Ниц").should("not.exist");cy.get(".founder-portrait figcaption").should("not.exist");cy.get(".biography-sources").contains("a","биография РБК").should("have.attr","href","https://www.rbc.ru/person/6addccc77ed5c3f0602233c7");});it("always distinguishes today from the selected day",()=>{const now=new Date(Date.now()+3*3600000);const day=now.getUTCDate();cy.visit("/calendar");cy.get("button[aria-current=date]").should("contain",day).and("have.attr","aria-pressed","true");cy.get(".calendar-grid").contains("button",new RegExp(`^${day===15?16:15}$`)).click();cy.get("button[aria-current=date]").should("contain",day).and("have.class","today");cy.get('[aria-label="Следующий месяц"]').click();cy.get("button[aria-current=date]").should("not.exist");cy.get(".calendar-today-bar").contains("button","Сегодня").click();cy.get("button[aria-current=date]").should("contain",day).and("have.attr","aria-pressed","true");cy.screenshot("calendar-today");});});

describe('Media stories and gallery',()=>{
 it('opens an event from the archive, browses photos and manages them in the editorial panel',()=>{
  cy.visit('/admin');
  cy.get('input[type=password]').type('e2e-password');
  cy.get('dialog.login-dialog').contains('button','Войти').click();
  cy.contains('button','Медиа').click();
  cy.contains('label','Название материала').find('input').type('Субботник: история E2E');
  cy.get('input[name=eventDate]').type('2025-05-17');
  cy.get('textarea[name=description]').type('17 мая 2025 · Аксай\n\nПодробный рассказ об уборке природной территории и участниках события.\n\nИсточник: https://example.org/report');
  cy.get('input[aria-label="Файл медиа"]').selectFile('content/media/aksay-cleanup-2025-01.jpg');
  cy.contains('label','Опубликовать на сайте').find('input').check();
  cy.contains('button','Сохранить материал').click();
  cy.contains('[role=status]','Материал сохранён');
  cy.contains('article','Субботник: история E2E').find('[aria-label^="Редактировать"]').click();
  cy.get('.editor-gallery input[type=file]').selectFile('content/media/aksay-cleanup-2025-02.jpg');
  cy.contains('button','Добавить фотографию').click();
  cy.get('.editor-gallery img').should('have.length',1);
  cy.get('.editor-gallery input[type=file]').selectFile('content/media/aksay-cleanup-2025-03.jpg');
  cy.contains('button','Добавить фотографию').click();
  cy.get('.editor-gallery img').should('have.length',2);
  cy.visit('/media');
  cy.contains('h3','Субботник: история E2E').find('a').click();
  cy.location('pathname').should('match',/^\/media\/[^/]+$/);
  cy.contains('h1','Субботник: история E2E');
  cy.contains('.media-story','Подробный рассказ');
  cy.get('.gallery-controls').first().should('contain','01 / 03');
  cy.get('.photo-gallery > .gallery-controls [aria-label="Следующее изображение"]').click();
  cy.get('.gallery-controls').first().should('contain','02 / 03');
  cy.get('[aria-label="Показать кадр 3"]').click().should('have.attr','aria-current','true');
  cy.get('.photo-gallery').focus().trigger('keydown',{key:'Home'});
  cy.get('.gallery-controls').first().should('contain','01 / 03');
  cy.get('.gallery-stage').click();
  cy.get('dialog.gallery-dialog').should('be.visible');
  cy.get('dialog [aria-label="Следующее изображение"]').click();
  cy.get('dialog .gallery-controls').should('contain','02 / 03');
  cy.get('dialog [aria-label="Закрыть полноэкранный просмотр"]').focus().type('{esc}');
  cy.get('dialog').should('not.be.visible');
  cy.get('.gallery-stage').should('be.focused');
  cy.get('[aria-label="Включить светлую тему"]').click();
  cy.screenshot('media-story-light-desktop',{capture:'fullPage'});
  cy.get('[aria-label="Включить тёмную тему"]').click();
  cy.screenshot('media-story-dark-desktop',{capture:'fullPage'});
  cy.viewport(390,844);
  cy.get('.gallery-stage').trigger('pointerdown',{clientX:250,pointerId:1}).trigger('pointerup',{clientX:100,pointerId:1});
  cy.get('.gallery-controls').first().should('contain','03 / 03');
  cy.document().then(d=>expect(d.documentElement.scrollWidth).to.be.at.most(390));
  cy.screenshot('media-story-dark-mobile',{capture:'fullPage'});
  cy.get('[aria-label="Включить светлую тему"]').click();
  cy.screenshot('media-story-light-mobile',{capture:'fullPage'});
  cy.reload();cy.contains('h1','Субботник: история E2E');
  cy.get('header [aria-label="Войти для редакции"]').click();
  cy.contains('button','Медиа').click();
  cy.contains('article','Субботник: история E2E').find('[aria-label^="Редактировать"]').click();
  cy.get('[aria-label="Удалить фотографию 1"]').click();
  cy.get('.editor-gallery img').should('have.length',1);
  cy.contains('article','Субботник: история E2E').find('[aria-label^="Удалить"]').click();
  cy.get('[role=alertdialog]').contains('button','Удалить').click();
  cy.contains('[role=status]','Запись удалена');
 });
});

describe('Themed select controls',()=>{
 it('opens styled menus, centers chevrons and supports keyboard on desktop and mobile',()=>{
  cy.visit('/media');
  cy.get('#boot-splash').should('not.exist');
  cy.get('select').should('not.exist');
  const order=()=>cy.contains('.select-field > label','Порядок').parent().find('[role=combobox]');
  const centered=()=>order().then($button=>{
    const box=$button[0].getBoundingClientRect();
    const icon=$button.find('.select-chevron')[0].getBoundingClientRect();
    expect(Math.abs(box.top+box.height/2-icon.top-icon.height/2)).to.be.lessThan(1);
  });
  centered();order().click().should('have.attr','aria-expanded','true');
  cy.get('[role=listbox]:visible').should('contain','Сначала новые');
  cy.screenshot('select-dark-desktop',{capture:'fullPage'});
  cy.get('[aria-label="Включить светлую тему"]').click();order().click();
  cy.screenshot('select-light-desktop',{capture:'fullPage'});
  cy.get('[role=option]:visible').contains('Сначала новые').click();
  order().should('contain','Сначала новые').and('be.focused');
  order().type('{enter}{home}{esc}').should('contain','Сначала новые').and('have.attr','aria-expanded','false');
  order().type('{enter}{home}{enter}').should('contain','От истоков');
  cy.viewport(390,844);centered();cy.get('.archive-controls .select-field').each($field=>expect($field[0].getBoundingClientRect().width).to.eq(354));order().click();
  cy.document().then(d=>expect(d.documentElement.scrollWidth).to.be.at.most(390));
  cy.screenshot('select-light-mobile',{capture:'fullPage'});
  cy.get('[aria-label="Включить тёмную тему"]').click();order().click();
  cy.screenshot('select-dark-mobile',{capture:'fullPage'});
  cy.get('#main').click('bottomRight');order().should('have.attr','aria-expanded','false');
 });
});


describe('Editorial login modal',()=>{
 it('opens over the current page, closes without navigation and enters the editor after authentication',()=>{
  cy.visit('/media');cy.get('#boot-splash').should('not.exist');
  const trigger=()=>cy.get('header [aria-label="Войти для редакции"]');
  trigger().click();cy.location('pathname').should('eq','/media');
  cy.get('dialog.login-dialog').should('be.visible').find('input[type=password]').should('be.focused');
  cy.screenshot('login-modal-dark-desktop',{capture:'viewport'});
  cy.get('dialog .login-close').click();trigger().should('be.focused');cy.location('pathname').should('eq','/media');
  cy.get('[aria-label="Включить светлую тему"]').click();trigger().click();
  cy.screenshot('login-modal-light-desktop',{capture:'viewport'});
  cy.get('dialog input').type('{esc}');cy.get('dialog.login-dialog').should('not.exist');trigger().should('be.focused');
  cy.viewport(390,740);trigger().click();cy.screenshot('login-modal-light-mobile',{capture:'viewport'});
  cy.get('dialog .login-close').click();cy.get('[aria-label="Включить тёмную тему"]').click();trigger().click();
  cy.screenshot('login-modal-dark-mobile',{capture:'viewport'});
  cy.get('dialog input').type('wrong-password');cy.get('dialog').contains('button','Войти').click();
  cy.get('dialog [role=alert]').should('contain','Неверный пароль');cy.location('pathname').should('eq','/media');
  cy.get('dialog input').should('have.value','wrong-password').clear().type('e2e-password');
  cy.get('dialog').contains('button','Войти').click();cy.location('pathname').should('eq','/admin');
  cy.get('dialog.login-dialog').should('not.exist');cy.contains('h1','Редакция');
 });
});


describe('Division activation',()=>{
 it('activates only after the editor adds a link and disables again when cleared',()=>{
  cy.visit('/divisions');cy.get('[aria-label="Найти город"]').type('Москва');
  cy.contains('.division-inactive','Москва').should('be.visible');
  cy.visit('/admin');cy.get('input[type=password]').type('e2e-password');cy.get('dialog').contains('button','Войти').click();
  cy.get('.tabs').contains('button','Подразделения').click();cy.viewport(320,844);cy.document().then(d=>expect(d.documentElement.scrollWidth).to.be.at.most(320));cy.viewport(1280,720);
  cy.get('[aria-label="Найти подразделение"]').type('Москва');
  cy.get('[aria-label="Редактировать подразделение Москва"]').click();
  cy.get('input[name=divisionUrl]').type('https://example.org/moscow');
  const contacts={coordinator:'Иван Иванов',contact:'+7 900 000-00-00',vk:'https://vk.com/example',max:'https://max.ru/example',telegram:'https://t.me/example',email:'editor@example.org',website:'https://example.org'};
  Object.entries(contacts).forEach(([name,value])=>cy.get(`input[name=${name}]`).should($input=>{expect($input).not.to.have.attr('required');}).type(value));
  cy.contains('button','Сохранить подразделение').click();
  cy.contains('[role=status]','Данные подразделения сохранены');
  cy.screenshot('admin-divisions',{capture:'fullPage'});cy.viewport(390,844);cy.document().then(d=>expect(d.documentElement.scrollWidth).to.be.at.most(390));cy.screenshot('admin-divisions-mobile',{capture:'fullPage'});cy.viewport(1280,720);
  cy.visit('/divisions');cy.get('[aria-label="Найти город"]').type('Москва');
  cy.contains('.division-grid a','Москва').should('have.attr','href','https://example.org/moscow');
  cy.reload();cy.get('[aria-label="Найти город"]').type('Москва');cy.contains('.division-grid a','Москва').should('have.attr','href','https://example.org/moscow');
  cy.get('header [aria-label="Войти для редакции"]').click();cy.get('.tabs').contains('button','Подразделения').click();
  cy.get('[aria-label="Найти подразделение"]').type('Москва');cy.get('[aria-label="Редактировать подразделение Москва"]').click();
  Object.entries(contacts).forEach(([name,value])=>cy.get(`input[name=${name}]`).should('have.value',value).clear());
  cy.get('input[name=divisionUrl]').should('have.value','https://example.org/moscow').clear();cy.contains('button','Сохранить подразделение').click();cy.contains('[role=status]','Данные подразделения сохранены');
  cy.visit('/divisions');cy.get('[aria-label="Найти город"]').type('Москва');cy.contains('.division-inactive','Москва').should('be.visible');cy.get('.division-grid a').should('not.exist');
 });
});
