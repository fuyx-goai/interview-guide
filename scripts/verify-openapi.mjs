import fs from 'node:fs'
import assert from 'node:assert/strict'

const read = name => JSON.parse(fs.readFileSync(new URL(`../docs/${name}`, import.meta.url), 'utf8'))
const source = read('api-design.json')
const api = read('openapi.json')

function resolve(schema) {
  if (schema.$ref) return api.components.schemas[schema.$ref.split('/').at(-1)]
  if (schema.allOf) return resolve(schema.allOf[0])
  return schema
}

function accepts(value, raw) {
  const schema = resolve(raw)
  if (value === null) return Boolean(schema.nullable)
  if (schema.oneOf && schema.oneOf.filter(branch => accepts(value, branch)).length !== 1) return false
  if (schema.required?.some(name => !(name in value))) return false
  if (schema.type === 'object') return acceptsObject(value, schema)
  if (schema.type === 'array') return Array.isArray(value) && value.length >= (schema.minItems || 0) && value.length <= (schema.maxItems || Infinity) && value.every(item => accepts(item, schema.items)) && (!schema.uniqueItems || new Set(value.map(item => JSON.stringify(item))).size === value.length)
  if (schema.type === 'string') return typeof value === 'string' && [...value].length >= (schema.minLength || 0) && [...value].length <= (schema.maxLength || Infinity) && (!schema.enum || schema.enum.includes(value))
  if (schema.type === 'integer') return Number.isInteger(value) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity)
  if (schema.type === 'number') return typeof value === 'number'
  if (schema.type === 'boolean') return typeof value === 'boolean'
  return true
}

function acceptsObject(value, schema) {
  if (typeof value !== 'object' || Array.isArray(value)) return false
  if (Object.keys(value).length < (schema.minProperties || 0)) return false
  if (schema.additionalProperties === false && Object.keys(value).some(name => !schema.properties[name])) return false
  return Object.entries(schema.properties || {}).every(([name, field]) => !(name in value) || accepts(value[name], field))
}

function compareFields(fields, raw) {
  const schema = resolve(raw)
  for (const [name, field] of Object.entries(fields)) {
    const actual = schema.properties[name]
    assert(actual, `字段丢失：${name}`)
    if (field.required) assert(schema.required?.includes(name), `必返约束丢失：${name}`)
    if (field.ref) compareFields(source['数据模型'][field.ref], actual)
    if (field.items?.ref) compareFields(source['数据模型'][field.items.ref], resolve(actual).items)
    if (field.properties) compareFields(field.properties, actual)
  }
}

let responses = 0
for (const module of source['页面模块']) {
  for (const endpoint of module['接口']) {
    const op = api.paths[endpoint['路径']][endpoint['请求方式'].toLowerCase()]
    const response = op.responses[String(endpoint['成功HTTP状态'] || 200)]
    const content = response.content['application/json']
    if (content) {
      compareFields(endpoint['返回参数'], content.schema.properties.data)
      assert(accepts(content.example, content.schema), `响应示例不符合最终Schema：${endpoint['路径']}`)
      responses += 1
    } else assert(response.headers['Content-Disposition'])
    const body = op.requestBody?.content['application/json']
    if (body) assert(accepts(body.example, body.schema), `请求示例不符合Schema：${endpoint['路径']}`)
    for (const error of endpoint['错误响应']) assert(op.responses[error.http_status].content['application/json'].examples[error.code])
  }
}
const bodyAt = (path, method) => api.paths[path][method].requestBody.content['application/json'].schema
const ai = bodyAt('/api/v1/ai/answers', 'post')
assert(!accepts({}, ai))
assert(!accepts({ question_id: 'q1', question_text: '问题' }, ai))
assert(accepts({ question_text: '缓存如何保持一致？' }, ai))
assert(!accepts({ question_text: '' }, ai))
assert(!accepts({ question_id: null }, ai))
const settings = bodyAt('/api/v1/me/settings', 'patch')
assert(!accepts({}, settings))
assert(!accepts({ unknown: true }, settings))
assert(!accepts({ name: '' }, settings))
assert(!accepts({ target_cities: ['北京', '北京'] }, settings))
const append = bodyAt('/api/v1/interviews/{interview_id}/questions', 'post')
assert(!accepts({ category_mode: 'auto', questions: [] }, append))
assert(!accepts({ category_mode: 'auto', questions: [''] }, append))
assert(!accepts({ category_mode: 'auto', questions: Array(201).fill('题目') }, append))
const save = source['页面模块'].flatMap(module => module['接口']).find(endpoint => endpoint['路径'] === '/api/v1/interviews' && endpoint['请求方式'] === 'POST')
assert(!('role' in save['请求示例']))
assert.equal(save['返回示例'].data.interview.role, '待补充职位')
assert.equal(save['返回示例'].data.interview.question_count, save['请求示例'].questions.length)
console.log(JSON.stringify({ json_responses_checked: responses, nested_models_and_required_preserved: true, request_and_response_examples_valid: true, invalid_request_cases_rejected: 11, error_examples_and_download_headers_checked: true }, null, 2))
