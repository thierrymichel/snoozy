/* eslint-disable cypress/no-unnecessary-waiting */
// describe('My First Test', () => {
//   it('Does not do much!', () => {
//     expect(true).to.equal(true)
//   })
// })
it('should perform basic google search', () => {
  cy.visit('https://google.com')
  cy.get('[name="q"]').type('subscribe').type('{enter}')
})
