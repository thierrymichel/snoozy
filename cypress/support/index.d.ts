/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable<Subject> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getByDataTest(tag: string): Chainable<any>
  }
}
