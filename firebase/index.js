import { initializeApp } from 'firebase/app'
import { getFirestore, collection, query, doc, getDocs, getDoc } from 'firebase/firestore'
import { getStorage, ref, getDownloadURL } from 'firebase/storage'

import { bundleMDX } from 'mdx-bundler'
import fs from 'fs'
import path from 'path'
import readingTime from 'reading-time'
// Remark packages
import remarkGfm from 'remark-gfm'
import remarkFootnotes from 'remark-footnotes'
import remarkMath from 'remark-math'
import remarkExtractFrontmatter from '@/lib/remark-extract-frontmatter'
import remarkCodeTitles from '@/lib/remark-code-title'
import remarkTocHeadings from '@/lib/remark-toc-headings'
import remarkImgToJsx from '@/lib/remark-img-to-jsx'
// Rehype packages
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeKatex from 'rehype-katex'
import rehypeCitation from 'rehype-citation'
import rehypePrismPlus from 'rehype-prism-plus'
import rehypePresetMinify from 'rehype-preset-minify'

const root = process.cwd()

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
}

// Initialize Firebase
export const firebaseApp = initializeApp(firebaseConfig)

export async function getBlogCollection() {
  let data = []
  const db = getFirestore(firebaseApp)
  const q = query(collection(db, 'blog'))
  const querySnapshot = await getDocs(q)
  querySnapshot.forEach((post) => {
    data.push(post.data())
  })

  return data
}

export async function getAllPostPath() {
  let data = []
  const db = getFirestore(firebaseApp)
  const q = query(collection(db, 'blog'))
  const querySnapshot = await getDocs(q)
  querySnapshot.forEach((post) => {
    data.push({
      params: {
        slug: `${post.data().slug}`,
      },
    })
  })
  return data
}

export async function getPostBySlug(slug) {
  const storage = getStorage(firebaseApp)
  const url = await getDownloadURL(ref(storage, `postMD/${slug}.md`))
  const response = await fetch(url)
  const textResponse = await response.text()
  const source = textResponse

  const db = getFirestore(firebaseApp)
  const docRef = doc(db, 'blog', slug)
  const docSnap = await getDoc(docRef)
  const frontmatter = docSnap.data()

  let toc = []

  const { code } = await bundleMDX({
    source,
    // mdx imports can be automatically source from the components directory
    cwd: path.join(root, 'components'),
    xdmOptions(options, frontmatter) {
      // this is the recommended way to add custom remark/rehype plugins:
      // The syntax might look weird, but it protects you in case we add/remove
      // plugins in the future.
      options.remarkPlugins = [
        ...(options.remarkPlugins ?? []),
        remarkExtractFrontmatter,
        [remarkTocHeadings, { exportRef: toc }],
        remarkGfm,
        remarkCodeTitles,
        [remarkFootnotes, { inlineNotes: true }],
        remarkMath,
        remarkImgToJsx,
      ]
      options.rehypePlugins = [
        ...(options.rehypePlugins ?? []),
        rehypeSlug,
        rehypeAutolinkHeadings,
        rehypeKatex,
        [rehypeCitation, { path: path.join(root, 'data') }],
        [rehypePrismPlus, { ignoreMissing: true }],
        rehypePresetMinify,
      ]
      return options
    },
    esbuildOptions: (options) => {
      options.loader = {
        ...options.loader,
        '.js': 'jsx',
      }
      return options
    },
  })

  return {
    mdxSource: code,
    toc,
    frontMatter: {
      readingTime: readingTime(code),
      slug: slug || null,
      ...frontmatter,
      date: frontmatter.date ? new Date(frontmatter.date).toISOString() : null,
    },
  }
}

export async function getAuthorProperties(username) {
  const db = getFirestore(firebaseApp)
  const docRef = doc(db, 'author', username)
  const docSnap = await getDoc(docRef)
  return docSnap.data()
}
