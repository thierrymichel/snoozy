import { sourceAttributes, sourceTags, targetTags } from '@/constants'

// Global
export interface GenericObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}
export interface SpecificObject<T> {
  [key: string]: T
}
export interface Hooks {
  beforeload?: Function
  loading?: Function
  loaded?: Function
  afterload?: Function
}
export interface Options extends Hooks {
  prefix?: string
}
export interface Supports {
  srcset: boolean
  // Usage ?
  // sizes: boolean
  // picture: boolean
}
// TODO: to be cleaned…
export interface Tag {
  name: TargetTag | SourceTag
  swappable: boolean
}

// Root
export interface RootData {
  root: HTMLElement
  target: TargetElement
  sources: SourceElement[]
  refs: Ref[]
  hooks: Hooks
}

// Src
export type SrcElement =
  | HTMLImageElement
  | HTMLVideoElement
  | HTMLIFrameElement
  | HTMLSourceElement

// Target
export type TargetElement =
  | HTMLImageElement
  | HTMLVideoElement
  | HTMLIFrameElement
  | HTMLPictureElement
export type TargetTag = typeof targetTags[number]

// Source
export type SourceAttribute = typeof sourceAttributes[number]
export type SourceElement = HTMLImageElement | HTMLSourceElement
export type SourceTag = typeof sourceTags[number]
export interface SourceData {
  attr: SourceAttribute
  origin: string
  resolved: string
  blob?: Blob
  url?: string
}

// Ref
export interface Ref {
  id: string
  tag: SourceTag
  data: SourceData
}
export interface CloneData {
  el: SourceElement
  data: SourceData
}

// Worker
export interface WorkerMessage {
  id: string
  ref: Ref
}
