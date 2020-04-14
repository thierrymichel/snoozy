import { Tag } from '@/types'

export const sourceAttributes = ['src', 'srcset'] as const
export const sourceTags = ['img', 'source'] as const
export const sourceSelector = sourceTags.join(',')
export const targetTags = ['img', 'picture', 'video', 'iframe'] as const
export const targetSelector = targetTags.join(',')
// TODO: check used properties, to be cleaned
// See also types/Tag ? :/
// Move to constants ?
export const tags: Tag[] = [
  {
    name: 'img',
    swappable: false,
    fetch: true,
    children: false,
    srcset: true,
  },
  {
    name: 'picture',
    swappable: false,
    fetch: true,
    children: true,
    srcset: false,
  },
  {
    name: 'video',
    swappable: true,
    fetch: true,
    children: true,
    srcset: false,
  },
  {
    name: 'iframe',
    swappable: true,
    fetch: false,
    children: false,
    srcset: false,
  },
  {
    name: 'source',
    swappable: false,
    fetch: false,
    children: false,
    srcset: true,
  },
]
