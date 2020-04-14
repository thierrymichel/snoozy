/* eslint-disable class-methods-use-this */
import { sourceSelector, targetSelector } from '@/constants'
import {
  CloneData,
  Options,
  Ref,
  RootData,
  SourceData,
  SourceElement,
  SourceTag,
  SrcElement,
  TargetElement,
  WorkerMessage,
} from '@/types'
import {
  blankImg,
  closestDescendant,
  // DEV
  // detectSupports,
  MapId,
  resolveUrl,
} from '@/utils'
import { worker } from '@/worker'

// TODO: add comments
class Loader {
  private _worker = worker
  private _options: Options = {} as Options
  // DEV
  // private _supports = detectSupports()
  private _blobUrlByOrigin: Map<string, string> = new Map()
  private _rootsMap: MapId<HTMLElement, RootData> = new MapId()
  private _sourcesMap: MapId<SourceElement, SourceData> = new MapId()

  constructor() {
    this._onMessage = this._onMessage.bind(this)
  }

  /**
   * Init loader with options
   */
  public init(options: Options) {
    this._options = options
    this._worker.addEventListener('message', this._onMessage)
  }

  /**
   * Add an element
   */
  public add(root: HTMLElement) {
    const target = this._getTarget(root)

    if (target === null) {
      console.error('[@snoozy] No target found')
      root.classList.remove('lazyloading')

      return null
    }

    const sources = this._getSources(target)

    if (
      [target, ...sources].every(el => !el.dataset.src && !el.dataset.srcset)
    ) {
      console.error('[@snoozy] No data found')
      root.classList.remove('lazyloading')

      return null
    }

    const refs: Ref[] = []
    const id = this._rootsMap.add(root, { root, target, sources, refs })

    console.info('ADD', id, `[${target.dataset.test}]`)

    if (root.dataset?.lazyMode !== 'visible') {
      this.load(root)
    }

    return id
  }

  /**
   * Start loading
   */
  public async load(root: HTMLElement) {
    // Get data from root element
    const { id, data } = this._getRootData(root)

    if (id === null) {
      console.error('[@snoozy] Not a valid element')

      return
    }

    root.classList.remove('lazyload')

    if (data.sources.length === 0) {
      this.swap(root)

      return
    }

    // Get and set refs
    data.refs = await this._getRefs(data)

    // Before load
    this._options.beforeload && this._options.beforeload(root)

    // Loading
    root.classList.add('lazyloading')
    this._options.loading && this._options.loading(root)

    if (this._hasLoaded(data.refs)) {
      // All sources are loaded…
      this.switch(data.root)
    } else {
      // Post to the worker
      data.refs.forEach(ref => {
        this._worker.postMessage({ id, ref } as WorkerMessage)
      })
    }
  }

  /**
   * Swap sources
   * Replace directly src with data-src
   */
  public swap(root: HTMLElement) {
    const { data } = this._getRootData(root)

    this._swapSrc(data.target as SrcElement)
    data.sources.forEach(el => this._swapSrc(el))
  }

  /**
   * Switch sources
   * Replace data with blob URLs
   */
  public switch(root: HTMLElement) {
    const { data } = this._getRootData(root)
    const { sources, target } = data
    const img = closestDescendant(target, 'img') as HTMLImageElement

    img.onload = async () => {
      // CSS classes
      root.classList.remove('lazyloading')

      // Transition
      this._options.loaded && (await this._options.loaded(root))

      // CSS classes
      root.classList.add('lazyloaded')

      // After transition
      this._options.afterload && this._options.afterload(root)

      // Cleaning
      // If revoked, can not be reused…
      // URL.revokeObjectURL(url)
    }

    sources.forEach(el => {
      const id = this._sourcesMap.getIdByKey(el)

      if (id) {
        const source = this._sourcesMap.getValueById(id) as SourceData
        const { attr, origin } = source
        const blob = this._blobUrlByOrigin.get(origin) as string

        if (attr === 'src') {
          el.src = blob
        } else if (attr === 'srcset') {
          el.srcset = el.dataset.srcset?.replace(origin, blob) as string
        }
      } else {
        if (el.dataset.src) {
          el.src = el.dataset.src
          el.removeAttribute('data-src')
        }
        if (el.dataset.srcset) {
          el.srcset = el.dataset.srcset
          el.removeAttribute('data-srcset')
        }
      }
    })
  }

  /**
   * On worker message, store new blob URLs
   * Start switch if ready…
   */
  private _onMessage(event: MessageEvent) {
    const { id, ref: newRef } = event.data as WorkerMessage
    const data = this._rootsMap.getValueById(id) as RootData
    const { refs } = data

    const { blob, origin } = newRef.data
    const url = URL.createObjectURL(blob)

    this._blobUrlByOrigin.set(origin, url)
    this._hasLoaded(refs) && this.switch(data.root)
  }

  /**
   * Get the target element to be lazy loaded
   * This allows to use some wrapper
   */
  private _getTarget(root: HTMLElement) {
    return closestDescendant(root, targetSelector)
  }

  /**
   * Get sources from the target element
   * Fast check for valid sources
   * Sources are elements with data attribute(s) to be lazyloaded
   * We can have multiple sources (picture > img + source)
   */
  private _getSources(target: TargetElement) {
    return [target, ...target.children].filter(e =>
      e.matches(sourceSelector)
    ) as SourceElement[]
  }

  /**
   * Get refs from the target and sources elements
   * Refs connect a source element with its data
   * because an HTMLElement can not be passed directly to a web worker.
   */
  private async _getRefs(data: RootData) {
    const { sources } = data
    const render = sources.some(el => el.matches('[data-srcset]'))

    if (render) {
      // Render target to know exactly which source to reference
      const ref = await this._getFromRender(data)

      return [ref]
    }

    // Get, replace and reference all sources with src attribute
    return sources.map(el => {
      const origin = this._getSrc(el)
      const data: SourceData = {
        attr: 'src',
        origin,
        resolved: resolveUrl(origin),
      }

      const id = this._sourcesMap.add(el, data)
      const tag = el.tagName.toLowerCase() as SourceTag

      return {
        id,
        tag,
        data,
      }
    })
  }

  private _getFromRender(data: RootData): Promise<Ref> {
    return new Promise(resolve => {
      const { target, sources } = data
      const w = (target as HTMLImageElement).width || target.offsetWidth
      const h = (target as HTMLImageElement).height || target.offsetHeight
      const clone = target.cloneNode(true) as TargetElement

      clone.style.position = 'fixed'
      clone.style.left = '200vw'
      clone.style.top = '200vh'
      clone.style.visibility = 'hidden'
      clone.style.width = `${w}px`
      clone.style.height = `${h}px`

      const contents: CloneData[] = []
      const clonedSources = this._getSources(clone)
      const img = closestDescendant(clone, 'img') as HTMLImageElement

      img.onload = () => {
        const srcTmp = img.currentSrc
        const index = parseInt(srcTmp.split('#')[1], 10) || 0
        const { el, data } = contents[index]
        const id = this._sourcesMap.add(el, data)
        const tag = el.tagName.toLowerCase() as SourceTag

        clone.remove()

        resolve({
          id,
          tag,
          data,
        })
      }

      let index = 0

      sources.forEach((el, i) => {
        if (el.dataset.src) {
          const origin = el.dataset.src

          contents.push({
            el,
            data: {
              attr: 'src',
              origin,
              resolved: resolveUrl(origin),
            },
          })

          clonedSources[i].src = `${blankImg}#${index}`
          index += 1
        }

        // TODO: add check supports…
        if (el.dataset.srcset) {
          clonedSources[i].srcset = el.dataset.srcset
            .split(',')
            .map(set => {
              const [src, w] = set.replace(/^ /, '').split(' ')
              const origin = src
              const newSet = `${blankImg}#${index} ${w}`

              contents.push({
                el,
                data: {
                  attr: 'srcset',
                  origin,
                  resolved: resolveUrl(origin),
                },
              })
              index += 1

              return newSet
            })
            .join(',') as string
        }
      })
    })
  }

  private _swapSrc(el: SrcElement) {
    if (el.hasAttribute('data-src')) {
      el.src = el.getAttribute('data-src') as string
    }
  }

  /**
   * Get src value
   */
  private _getSrc(el: SourceElement | SrcElement): string {
    return el.getAttribute('data-src') as string
  }

  /**
   * Get data (id, value) associated to a root element
   * Add it if not present
   */
  private _getRootData(root: HTMLElement) {
    const id = this._rootsMap.getIdByKey(root) || this.add(root)
    const data = this._rootsMap.getValueByKey(root) as RootData

    return { id, data }
  }

  /**
   * Are all blob URLs loaded?
   */
  private _hasLoaded(refs: Ref[]) {
    return refs.every(ref => this._blobUrlByOrigin.has(ref.data.origin))
  }

  /**
   * Does this origin have a blob URL?
   */
  // private _hasUrl(source: SourceData | undefined) {
  //   return source && this._blobUrlByOrigin.has(source.origin)
  // }
}

export default new Loader()
