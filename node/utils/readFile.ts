import fs from 'fs'
import path from 'path'

const readFile = (filePath: string) =>
  fs.readFileSync(path.resolve(__dirname, filePath), 'utf8')

export default readFile
