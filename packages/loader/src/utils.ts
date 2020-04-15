import { Supports, Tag } from '@/types'
import { tags } from '@/constants'

export function isTag(name: Tag['name'], prop: keyof Tag) {
  return tags.find(t => t.name === name.toLowerCase() && t[prop])
}

// https://stackoverflow.com/a/52609903/2372418
export function closestDescendant(root: HTMLElement, selector: string) {
  const elements = [root as Element]
  let e

  do {
    e = elements.shift() as HTMLElement
  } while (!e.matches(selector) && elements.push(...e.children))

  return e.matches(selector) ? e : null
}

export function detectSupports() {
  const supports: Supports = {
    srcset: false,
    sizes: false,
    picture: false,
  }

  const img = new Image()

  if ('srcset' in img) {
    supports.srcset = true
  }

  if ('sizes' in img) {
    supports.sizes = true
  }

  if ('HTMLPictureElement' in window) {
    supports.picture = true
  }

  return supports
}

export function randomId() {
  return `_${(
    Number(String(Math.random()).slice(2)) +
    Date.now() +
    Math.round(performance.now())
  ).toString(36)}`
}

// Copyright 2014 Simon Lydell
// X11 (“MIT”) Licensed. (See LICENSE
// https://github.com/lydell/resolve-url/blob/master/resolve-url.js
/* istanbul ignore next */
export function resolveUrl(...urls: string[]) {
  const numUrls = urls.length

  if (numUrls === 0) {
    throw new Error('resolveUrl requires at least one argument; got none.')
  }

  const base = document.createElement('base')

  ;[base.href] = urls

  if (numUrls === 1) {
    return base.href
  }

  const [head] = document.getElementsByTagName('head')
  head.insertBefore(base, head.firstChild)

  const a = document.createElement('a')
  let resolved = ''

  for (let index = 1; index < numUrls; index++) {
    a.href = urls[index]
    resolved = a.href
    base.href = resolved
  }

  head.removeChild(base)

  return resolved
}

// https://gist.github.com/fupslot/5015897
const b64toBlob = (b64Data: string, type = '') => {
  const byteString = atob(b64Data)
  // Write the bytes of the string to an ArrayBuffer
  const ab = new ArrayBuffer(byteString.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }
  const blob = new Blob([ab], { type })

  return blob
}
const data = 'R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
const gif = 'image/gif'
const blankBlob = b64toBlob(data, gif)

export const blankData = `data:${gif};base64,${data}`
export const blankImg = URL.createObjectURL(blankBlob)

/**
 * Map using unique ID relation
 * Useful to create relation between data and DOMElement
 * that can be passed to a web worker (HTMLElement object could not be cloned)
 */
export class MapId<T, U> extends Map<T, U> {
  private _idByKey: Map<T, string> = new Map()

  private static _createId() {
    return randomId()
  }

  // Prefer `add` method that returns the ID
  public set(key: T, value: U) {
    this.add(key, value)

    return this
  }

  public delete(key: T) {
    return this._idByKey.delete(key) && super.delete(key)
  }

  public clear() {
    this._idByKey.clear()
    super.clear()
  }

  // Additional
  public add(key: T, value: U) {
    const id = MapId._createId()

    this._idByKey.set(key, id)
    super.set(key, value)

    return id
  }

  public deleteById(id: string) {
    this.delete(this.getKeyById(id))
  }

  // Getters
  public getKeyById(id: string) {
    const keys: T[] = []

    this._idByKey.forEach((i, k) => {
      if (i === id) {
        keys.push(k)
      }
    })

    return keys[0]
  }

  public getIdByKey(key: T) {
    return this._idByKey.get(key)
  }

  public getValueById(id: string) {
    return this.getValueByKey(this.getKeyById(id))
  }

  public getValueByKey(key: T) {
    return this.get(key)
  }

  // Iterators
  public ids() {
    return this._idByKey.values()
  }
}
