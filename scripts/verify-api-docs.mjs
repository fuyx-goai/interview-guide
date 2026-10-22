import fs from 'node:fs'

const source = JSON.parse(fs.readFileSync(new URL('../docs/api-design.json', import.meta.url), 'utf8'))
const markdown = fs.readFileSync(new URL('../docs/api-design.md', import.meta.url), 'utf8')
const endpoints = source['页面模块'].flatMap(module => module['接口'])
let fieldCount = 0

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function checkFields(fields) {
  for (const [name, field] of Object.entries(fields)) {
    if (typeof field !== 'object') continue
    assert(field['字段说明'] && field['字段注释'], `缺少字段说明或注释：${name}`)
    fieldCount += 1
    if (field.properties) checkFields(field.properties)
  }
}

function checkValue(value, field, path) {
  if (value === null) {
    assert(field.nullable, `${path}不允许为null`)
    return
  }
  if (field.ref) return checkObject(value, source['数据模型'][field.ref], path)
  if (field.type === 'array') {
    assert(Array.isArray(value), `${path}必须是数组`)
    for (const item of value) checkValue(item, typeof field.items === 'string' ? { type: field.items } : field.items, `${path}[]`)
    return
  }
  if (field.properties) return checkObject(value, field.properties, path)
  const expectedType = field.type === 'integer' ? 'number' : field.type
  assert(typeof value === expectedType, `${path}类型不匹配`)
  if (field.type === 'integer') assert(Number.isInteger(value), `${path}必须是整数`)
  if (field.enum) assert(field.enum.includes(value), `${path}不在枚举范围内`)
}

function checkObject(value, fields, path) {
  assert(value && typeof value === 'object', `${path}必须是对象`)
  for (const [name, field] of Object.entries(fields)) {
    if (field.required) assert(name in value, `${path}.${name}缺少必填字段`)
    if (name in value) checkValue(value[name], field, `${path}.${name}`)
  }
}

for (const fields of Object.values(source['数据模型'])) checkFields(fields)
for (const endpoint of endpoints) {
  checkFields(endpoint['请求参数'])
  checkFields(endpoint['返回参数'])
  if (endpoint['返回示例'].data) checkObject(endpoint['返回示例'].data, endpoint['返回参数'], endpoint['路径'])
  assert(endpoint['批注']['实现逻辑'].includes('1.'), `缺少分步说明：${endpoint['路径']}`)
  assert(endpoint['批注']['表关系举例'], `缺少关系举例：${endpoint['路径']}`)
}
assert((markdown.match(/^#### 请求示例$/gm) || []).length === 20, '请求示例不完整')
assert((markdown.match(/^#### 返回示例$/gm) || []).length === 20, '返回示例不完整')
assert(markdown.includes('active_resume.name') && markdown.includes('items[].company'), '嵌套字段未展开')
assert((markdown.match(/^```/gm) || []).length % 2 === 0, '代码块未闭合')
console.log(JSON.stringify({ interfaces: endpoints.length, annotated_fields: fieldCount, response_examples_match_models: true, nested_fields_expanded: true, workflow_and_relations_complete: true }, null, 2))
