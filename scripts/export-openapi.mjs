import fs from 'node:fs'
import { enrich } from './enrich-api.mjs'

const source = enrich(JSON.parse(fs.readFileSync(new URL('../docs/api-design.json', import.meta.url), 'utf8')))
const schemaRef = name => ({ $ref: `#/components/schemas/${name}` })

function convertSchema(field) {
  if (typeof field === 'string') return { type: field === 'string' ? 'string' : field }
  if (field.ref) {
    const reference = field.nullable ? { ...objectSchema(source['数据模型'][field.ref]), nullable: true } : { allOf: [schemaRef(field.ref)] }
    return { ...reference, description: field.description }
  }
  const result = { type: field.type === 'binary' ? 'string' : field.type }
  if (field.type === 'binary') result.format = 'binary'
  for (const key of ['description', 'nullable', 'enum', 'minimum', 'maximum', 'example', 'minLength', 'maxLength', 'minItems', 'maxItems', 'uniqueItems', 'format', 'default']) {
    if (field[key] !== undefined) result[key] = field[key]
  }
  if (result.type === 'array') {
    result.items = convertSchema(field.items || 'string')
    if (result.minimum !== undefined) { result.minItems = result.minimum; delete result.minimum }
    if (result.maximum !== undefined) { result.maxItems = result.maximum; delete result.maximum }
  }
  if (field.properties) Object.assign(result, objectSchema(field.properties))
  return result
}

function objectSchema(fields) {
  const entries = Object.entries(fields).filter(([, field]) => typeof field === 'object')
  const result = { type: 'object', properties: Object.fromEntries(entries.map(([name, field]) => [name, convertSchema(field)])) }
  const required = entries.filter(([, field]) => field.required).map(([name]) => name)
  if (required.length) result.required = required
  return result
}

function responseSchema(fields) {
  const envelope = objectSchema({
    code: { type: 'string', required: true, description: '业务结果码；OK表示成功，其他值用于识别具体业务错误。' }, message: { type: 'string', required: true, description: '面向用户的结果提示，例如保存成功或当前简历尚未解析完成。' },
    request_id: { type: 'string', required: true, description: '本次请求的追踪编号，向后端反馈问题时用于定位日志。' },
    data: { type: 'object', required: true, description: '本接口的业务返回数据，字段在当前对象内展开。' }
  })
  Object.assign(envelope.properties.data, objectSchema(fields))
  return envelope
}

function describe(endpoint) {
  const notes = endpoint['批注']
  return [notes['设计思路'], `实现逻辑：\n${notes['实现逻辑']}`, `涉及数据表：${notes['数据表'].join('、') || '无'}`, `表关联：${notes['关联关系']}`, `关系举例：${notes['表关系举例']}`, `页面接入流程：\n${endpoint['接入流程'].map((step, i) => `${i + 1}. ${step}`).join('\n')}`, endpoint['请求参数']['约束'] || ''].filter(Boolean).join('\n\n')
}

function parametersFor(endpoint) {
  const method = endpoint['请求方式']
  const parameters = Object.entries(endpoint['请求参数']).filter(([, field]) => typeof field === 'object').filter(([, field]) => field['位置'] === 'path' || method === 'GET').map(([name, field]) => ({
    name, in: field['位置'] === 'path' ? 'path' : 'query', required: field['位置'] === 'path' || Boolean(field.required),
    description: field.description || name, schema: convertSchema(field)
  }))
  if (method === 'POST' && !endpoint['路径'].endsWith('/views')) parameters.push({ name: 'Idempotency-Key', in: 'header', required: true, description: '24小时内按用户与接口去重；相同键不同内容返回409', schema: { type: 'string' } })
  return parameters
}

function operationFor(endpoint, tag, index) {
  const method = endpoint['请求方式']
  const binary = endpoint['返回参数'].body?.type === 'binary'
  const status = String(endpoint['成功HTTP状态'] || 200)
  const operation = { tags: [tag], summary: endpoint['接口名称'], operationId: `operation_${index}`, description: describe(endpoint), parameters: parametersFor(endpoint), responses: {} }
  const fields = Object.fromEntries(Object.entries(endpoint['请求参数']).filter(([, field]) => typeof field === 'object' && field['位置'] !== 'path'))
  if (method !== 'GET' && Object.keys(fields).length) operation.requestBody = { required: true, content: { [endpoint['内容类型'] || 'application/json']: { schema: objectSchema(fields) } } }
  if (operation.requestBody) Object.assign(operation.requestBody.content[endpoint['内容类型'] || 'application/json'].schema, { additionalProperties: false, ...endpoint['请求体约束'] })
  if (operation.requestBody && !endpoint['内容类型']) operation.requestBody.content['application/json'].example = Object.fromEntries(Object.entries(endpoint['请求示例']).filter(([name]) => fields[name]))
  const content = binary
    ? { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { schema: { type: 'string', format: 'binary' } } }
    : { 'application/json': { schema: responseSchema(endpoint['返回参数']), example: endpoint['返回示例'] } }
  if (binary && endpoint['路径'].includes('/templates/')) content['text/csv'] = { schema: { type: 'string' }, example: endpoint['返回示例'].body }
  operation.responses[status] = { description: binary ? '文件下载成功，响应为二进制，不使用JSON封装' : '请求成功', content }
  if (binary) operation.responses[status].headers = { 'Content-Disposition': { description: '附件文件名，支持filename*=UTF-8编码文件名', schema: { type: 'string' }, example: 'attachment; filename=questions.xlsx' } }
  for (const error of endpoint['错误响应']) {
    const code = String(error.http_status)
    operation.responses[code] ||= { description: source['通用约定']['HTTP状态'][code], content: { 'application/json': { schema: schemaRef('ErrorResponse'), examples: {} } } }
    const { http_status, ...example } = error
    operation.responses[code].content['application/json'].examples[error.code] = { summary: error.message, value: example }
  }
  operation.responses['429'].headers = { 'Retry-After': { description: '建议等待秒数', schema: { type: 'integer', minimum: 1 }, example: 10 } }
  return operation
}

const schemas = Object.fromEntries(Object.entries(source['数据模型']).map(([name, fields]) => [name, objectSchema(fields)]))
schemas.ErrorResponse = { type: 'object', required: ['code', 'message', 'request_id', 'data'], properties: { code: { type: 'string', description: '具体业务错误码，见各接口列出的示例' }, message: { type: 'string', description: '面向用户的错误提示' }, request_id: { type: 'string', description: '用于定位日志的请求编号' }, data: { type: 'object', nullable: true, description: '错误时固定返回null' } } }
const databaseDescription = source['建议数据表与关联'].map(table => `### ${table['表']}\n${table['用途']}\n\n主键：${table['主键']}\n\n字段：${table['关键字段'].join('、')}\n\n关联：${table['关联'].join('；')}\n\n约束：${(table['约束索引'] || []).join('；')}`).join('\n\n')
const document = {
  openapi: '3.0.3',
    info: { title: source['文档名称'], version: source['版本'], description: `${source['状态']}。${source['分析依据']['事实']}\n\n## 通用约定\n${JSON.stringify(source['通用约定'], null, 2)}\n\n## 页面字段映射\n${source['页面字段映射'].map(row => row.join(' → ')).join('\n\n')}\n\n## 数据表与关联\n${databaseDescription}` },
  servers: [{ url: 'http://localhost:8080', description: '本地开发占位地址，请替换为实际服务地址；路径已包含/api/v1' }],
  tags: source['页面模块'].map(module => ({ name: module['模块'] })),
  security: [{ bearerAuth: [] }],
  paths: {},
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } }, schemas }
}
let index = 0
for (const module of source['页面模块']) {
  for (const endpoint of module['接口']) {
    const path = endpoint['路径']
    document.paths[path] ||= {}
    document.paths[path][endpoint['请求方式'].toLowerCase()] = operationFor(endpoint, module['模块'], ++index)
  }
}
fs.writeFileSync(new URL('../docs/openapi.json', import.meta.url), `${JSON.stringify(document, null, 2)}\n`)
console.log(`已导出 ${index} 个接口到 docs/openapi.json`)
