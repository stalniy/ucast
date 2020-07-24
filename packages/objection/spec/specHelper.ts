import chai from 'chai'
import spies from 'chai-spies'

chai.use(spies)

export const expect = chai.expect
export const spy = chai.spy
export function linearize(value: TemplateStringsArray) {
  return value.join('').replace(/[\n\r] */g, ' ').trim()
}
