/* eslint-disable class-methods-use-this */
import { sourceSelector, targetSelector } from '@/constants'
import {
  CloneData,
  Options,
  Ref,
  RootData,
  SourceAttribute,
  SourceData,
  SourceElement,
  SourceTag,
  SrcElement,
  TargetElement,
  WorkerMessage,
  TargetTag,
} from '@/types'
import {
  blankImg,
  closestDescendant,
  // DEV
  // detectSupports,
  isTag,
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
    // Context bonding
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
    const target = closestDescendant(root, targetSelector)

    // Target check
    if (target === null) {
      console.error('[@snoozy] No target found')
      root.classList.remove('lazyloading')

      return null
    }

    const sources = this._getSources(target)

    // Data sources check
    if (
      [target, ...sources].every(el => !el.dataset.src && !el.dataset.srcset)
    ) {
      console.error('[@snoozy] No data found')
      root.classList.remove('lazyloading')

      return null
    }

    // Store root related infos
    const refs: Ref[] = []
    const id = this._rootsMap.add(root, { root, target, sources, refs })

    console.info('ADD', id, `[${target.dataset.test}]`)

    // TODO: "autoload" scenarios
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

    if (this._useSwap(data)) {
      this.swap(root)

      return
    }

    // Get and set refs
    // Refs are source elements with data that need to be loaded
    data.refs = await this._getRefs(data)

    // Before load hook
    this._options.beforeload && this._options.beforeload(root)

    // Start loading
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

    this._swapAttr(data.target as SrcElement)
    data.sources.forEach(el => this._swapAttr(el))
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

      // Loaded hook transition
      this._options.loaded && (await this._options.loaded(root))

      // CSS classes
      root.classList.add('lazyloaded')

      // After hook
      this._options.afterload && this._options.afterload(root)

      // Cleaning
      // If revoked, can not be reused…
      // URL.revokeObjectURL(url)
    }

    sources.forEach(el => {
      const id = this._sourcesMap.getIdByKey(el)

      if (id) {
        // We have a blob URL for replacement
        const source = this._sourcesMap.getValueById(id) as SourceData
        const { attr, origin } = source
        const blob = this._blobUrlByOrigin.get(origin) as string

        if (attr === 'src') {
          el.src = blob
        } else if (attr === 'srcset') {
          el.srcset = el.dataset.srcset?.replace(origin, blob) as string
        }
      } else {
        // Nothing loaded, simply update attributes
        this._swapAttr(el, 'src')
        this._swapAttr(el, 'srcset')
      }
    })
  }

  /**
   * On worker message, store new blob URLs
   * Start switch if ready…
   */
  private _onMessage(event: MessageEvent) {
    const { id, ref: newRef } = event.data as WorkerMessage

    // Add new blob URL for origin
    const { blob, origin } = newRef.data
    const url = URL.createObjectURL(blob)
    this._blobUrlByOrigin.set(origin, url)

    // If all refs are loaded, switch
    const data = this._rootsMap.getValueById(id) as RootData
    this._hasLoaded(data.refs) && this.switch(data.root)
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

  private _setRef(el: SourceElement, data: SourceData) {
    const id = this._sourcesMap.add(el, data)
    const tag = el.tagName.toLowerCase() as SourceTag

    return {
      id,
      tag,
      data,
    }
  }

  /**
   * Get refs from the target and sources elements
   * Refs connect a source element with its data
   * because an HTMLElement can not be passed directly to a web worker.
   */
  private async _getRefs(data: RootData) {
    const { sources } = data

    if (this._useRender(data)) {
      // Render target to know exactly which source to reference
      const ref = await this._getFromRender(data)

      return [ref]
    }

    // Get, replace and reference all sources with src attribute
    return sources.map(el => {
      const origin = el.dataset.src as string
      const data: SourceData = {
        attr: 'src',
        origin,
        resolved: resolveUrl(origin),
      }

      return this._setRef(el, data)
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

        clone.remove()
        resolve(this._setRef(el, data))
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
        // If srcset or wathever is not supported…
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

  private _swapAttr(el: SrcElement, attr: SourceAttribute = 'src') {
    if (el.dataset[attr]) {
      el.setAttribute(attr, el.dataset[attr] as string)
      el.removeAttribute(`data-${attr}`)
    }
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
   * Check if rendering is needed
   * to get accurate source (media, srcset, sizes, …)
   */
  private _useRender(data: RootData) {
    return data.sources.some(el => el.matches('[data-srcset]'))
  }

  /**
   * Check if element needs to be swap (vs switch)
   */
  private _useSwap(data: RootData) {
    return isTag(data.target.tagName.toLowerCase() as TargetTag, 'swappable')
  }
}

export default new Loader()
