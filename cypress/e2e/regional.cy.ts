describe('Regional division lifecycle',()=>{
 it('creates and renames a district, hides drafts, archives and restores without losing contacts',()=>{
  const enter=()=>{cy.get('header [aria-label="Войти для редакции"]').click();cy.get('.tabs').contains('button','Подразделения').click();};
  const edit=()=>cy.get('[aria-label="Редактировать подразделение ВАО — E2E"]').click();
  cy.visit('/admin?section=divisions');cy.get('input[type=password]').type('e2e-password');cy.get('dialog.login-dialog').contains('button','Войти').click();
  cy.get('[aria-label="Добавить подразделение"]').click();
  cy.contains('label','Название подразделения').find('input').type('ВАО — E2E');
  cy.get('input[name=coordinator]').type('Координатор E2E');
  cy.contains('button','Сохранить подразделение').click();cy.contains('[role=status]','Данные подразделения сохранены');
  cy.visit('/divisions');cy.get('[aria-label="Найти город"]').type('ВАО — E2E');cy.contains('Подразделение не найдено');
  enter();edit();cy.contains('label','Название подразделения').find('input').clear().type('ВАО — E2E переименован');
  cy.contains('label','Опубликовать на сайте').find('input').check();cy.contains('button','Сохранить подразделение').click();cy.contains('[role=status]','Данные подразделения сохранены');
  cy.visit('/divisions');cy.contains('.division-inactive','ВАО — E2E переименован').should('be.visible').and('have.attr','aria-disabled','true');
  enter();cy.get('[aria-label="Редактировать подразделение ВАО — E2E переименован"]').click();
  cy.get('input[name=coordinator]').should('have.value','Координатор E2E');
  cy.contains('button','Убрать подразделение').click();cy.get('[role=alertdialog]').contains('button','Убрать в архив').click();cy.contains('[role=status]','Подразделение убрано в архив');
  cy.screenshot('regional-divisions-archive-dark',{capture:'viewport'});
  cy.get('[aria-label="Добавить подразделение"]').should('be.disabled');
  cy.get('[aria-label="Включить светлую тему"]').click();
  cy.get('[aria-label="Редактировать подразделение ВАО — E2E переименован"]').click();
  cy.get('input[name=coordinator]').should('be.disabled').and('have.value','Координатор E2E');
  cy.viewport(390,844);cy.document().then(d=>{
    const overflow=[...d.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>391).map(e=>({tag:e.tagName,class:e.className,width:e.getBoundingClientRect().width,text:e.textContent?.slice(0,55)}));
    expect(d.documentElement.scrollWidth,JSON.stringify(overflow)).to.be.at.most(390);
  });cy.screenshot('regional-divisions-restore-light-mobile',{capture:'fullPage'});
  cy.contains('button','Восстановить как черновик').click();cy.contains('[role=status]','Подразделение восстановлено как черновик');
  cy.visit('/divisions');cy.get('[aria-label="Найти город"]').type('ВАО — E2E переименован');cy.contains('Подразделение не найдено');
  cy.visit('/admin?section=media');
  cy.get('[aria-label="Добавить материал"]').click();cy.get('input[name=title]').type('Архивная проверка');
  cy.get('input[aria-label="Файл медиа"]').selectFile('content/media/aksay-cleanup-2025-01.jpg');
  cy.contains('button','Сохранить материал').click();cy.contains('[role=status]','Материал сохранён');
  cy.request('/api/session').then(({body})=>cy.request('/api/admin/content').then(({body:content})=>{
   const media=content.media.find((m:{title:string})=>m.title==='Архивная проверка');
   cy.request({method:'PATCH',url:`/api/admin/media/${media.id}/archive`,headers:{'x-csrf-token':body.csrf},body:{archived:true}});
  }));
  cy.reload();cy.contains('h3','Архивная проверка').should('not.exist');
  cy.get('[role=tab]').contains('Архив').click();cy.get('[aria-label="Добавить материал"]').should('be.disabled');
  cy.contains('article','Архивная проверка').should('not.contain','Опубликовать').contains('button','Восстановить материал').click();
  cy.contains('[role=status]','Материал восстановлен как черновик');
  cy.get('[role=tab]').contains('Материалы').click();cy.contains('article','Архивная проверка').should('contain','Черновик');
  cy.viewport(390,844);cy.get('[aria-label="Добавить материал"]').click();cy.get('.editor-dialog').should('be.visible');
  cy.get('.editor-dialog input[name=title]').should('be.focused').type('{esc}');
  cy.get('.editor-dialog').should('not.exist');cy.get('[aria-label="Добавить материал"]').should('be.focused');
  cy.document().then(d=>expect(d.documentElement.scrollWidth).to.be.at.most(390));
 });
});
