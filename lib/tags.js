import fs from 'fs'
import kebabCase from './utils/kebabCase'
import { getBlogCollection } from '../firebase'

const root = process.cwd()

export async function getAllTags(type) {
  const files = await getBlogCollection(type)

  let tagCount = {}
  // Iterate through each post, putting all found tags into `tags`
  files.forEach((data) => {
    if (data.tags && data.draft !== true) {
      data.tags.forEach((tag) => {
        const formattedTag = kebabCase(tag)
        if (formattedTag in tagCount) {
          tagCount[formattedTag] += 1
        } else {
          tagCount[formattedTag] = 1
        }
      })
    }
  })

  return tagCount
}
