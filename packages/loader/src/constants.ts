import { Tag } from '@/types'

export const sourceAttributes = ['src', 'srcset'] as const
export const sourceTags = ['img', 'source'] as const
export const sourceSelector = sourceTags.join(',')
export const targetTags = ['img', 'picture', 'video', 'iframe'] as const
export const targetSelector = targetTags.join(',')
export const tags: Tag[] = [
  {
    name: 'img',
    swappable: false,
  },
  {
    name: 'picture',
    swappable: false,
  },
  {
    name: 'video',
    swappable: true,
  },
  {
    name: 'iframe',
    swappable: true,
  },
  {
    name: 'source',
    swappable: false,
  },
]
