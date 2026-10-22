import fs from 'node:fs'
import { enrich } from './enrich-api.mjs'

const source = enrich(JSON.parse(fs.readFileSync(new URL('../docs/api-design.json', import.meta.url), 'utf8')))
const lines = []
const append = (...parts) => lines.push(...parts, '')
const cell = value => String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', '<br>')
const json = value => ['```json', JSON.stringify(value, null, 2), '```'].join('\n')

function fieldRows(fields, prefix = '', defaultLocation = '') {
  return Object.entries(fields).flatMap(([name, field]) => {
    if (typeof field !== 'object') return []
    const path = prefix ? `${prefix}.${name}` : name
    const type = field.ref || (field.type === 'array' ? `array<${typeof field.items === 'string' ? field.items : field.items?.ref || field.items?.type || 'object'}>` : field.type)
    const constraints = ['minLength', 'maxLength', 'minItems', 'maxItems', 'format', 'default', 'uniqueItems'].filter(key => field[key] !== undefined).map(key => `${key}=${field[key]}`)
    if (field.items?.minLength) constraints.push(`每项长度${field.items.minLength}～${field.items.maxLength}`)
    const details = [field['字段注释'] || field.description, field.enum && `可选值：${field.enum.join('、')}`, field.minimum !== undefined && `最小值/项数：${field.minimum}`, field.maximum !== undefined && `最大值/项数：${field.maximum}`, ...constraints, field.nullable && '允许 null'].filter(Boolean).join('；')
    const row = [path, field['位置'] || defaultLocation || '—', type, field.required ? '是' : '否', field['字段说明'], details || '—'].map(cell)
    const nested = field.properties || source['数据模型'][field.ref || field.items?.ref]
    const nestedPath = field.type === 'array' ? `${path}[]` : path
    return [`| ${row.join(' | ')} |`, ...(nested ? fieldRows(nested, nestedPath, defaultLocation) : [])]
  })
}

function fieldTable(fields, location) {
  const rows = fieldRows(fields, '', location)
  return rows.length ? ['| 字段 | 位置 | 类型/模型 | 必填/必返 | 字段说明 | 字段注释（用途、规则与空值处理） |', '| --- | --- | --- | --- | --- | --- |', ...rows].join('\n') : '无。'
}

append(`# ${source['文档名称']}`, `版本：${source['版本']}　日期：${source['日期']}　状态：**${source['状态']}**`)
append('## 文档说明', source['分析依据']['事实'], '本文为可读版接口文档；导入 Apifox / ApiPost 请使用同目录的 [openapi.json](./openapi.json)。', '字段类型引用的数据模型见文末；返回参数表描述 JSON 封装中的 `data`。下载接口直接返回文件。')
append(source['模拟数据说明'], '字段说明解释“这个字段是什么”；字段注释解释“页面怎么用、取值代表什么、有哪些限制”。嵌套对象及数组元素字段直接展开，例如 `active_resume.name`、`items[].company`。JSON示例保持合法，不插入双斜线注释。', '统一响应外层字段：`code`为业务结果码（OK表示成功）；`message`为用户可读提示；`request_id`为排查日志的请求编号；`data`为本次业务结果。')
append('## 页面与接口目录', '| 页面模块 | 请求方式 | 路径 | 接口名称 |', '| --- | --- | --- | --- |')
for (const module of source['页面模块']) {
  for (const endpoint of module['接口']) lines.push(`| ${module['模块']} | ${endpoint['请求方式']} | \`${endpoint['路径']}\` | ${endpoint['接口名称']} |`)
}
append('')
append('## 前端现状与边界')
for (const key of ['已实现前端交互', '占位功能', '原型偏差']) append(`### ${key}`, ...source['分析依据'][key].map(item => `- ${item}`))
append('## 页面字段适配约定', '采用统一前端适配层，接口保留英文结构化字段；当前原型尚未修改，接入时按下表转换。', '| 现有页面字段 | 接口字段 | 处理规则 |', '| --- | --- | --- |', ...source['页面字段映射'].map(row => `| ${row.map(cell).join(' | ')} |`))
append('## 各页面接入流程', '以下是联调时必须实现的交互约定，不表示原型页面已经接入。侧栏用户信息在首页初始化后保存到共享状态；如未来增加可直达的独立路由，需要另行处理应用初始化。')
for (const [page, steps] of Object.entries(source['接入规范'])) append(`### ${page}`, ...steps.map((step, index) => `${index + 1}. ${step}`))
append('## 审查问题修订记录', '| 审查项 | 本次处理 |', '| --- | --- |', ...Object.entries(source['修订说明']).map(([id, note]) => `| ${id} | ${note} |`), '原审查报告为1.0版本问题快照；本次解决契约与文档问题，实际前端接入、后端实现和端到端验证仍待执行。')
append('## 通用约定')
for (const [name, value] of Object.entries(source['通用约定'])) {
  append(`### ${name}`, typeof value === 'string' ? value : Array.isArray(value) ? value.map(item => `- ${item}`).join('\n') : json(value))
}
let count = 0
for (const module of source['页面模块']) {
  append(`## ${module['模块']}`)
  for (const endpoint of module['接口']) {
    count += 1
    const method = endpoint['请求方式']
    const path = endpoint['路径']
    append(`### ${count}. ${endpoint['接口名称']}`, `**对应功能模块：** ${endpoint['对应功能模块']}`, `**请求：** \`${method} ${path}\``, `**请求类型：** ${endpoint['内容类型'] || 'application/json（有请求体时）'}`, `**成功状态码：** ${endpoint['成功HTTP状态'] || 200}`)
    append('#### 请求参数', fieldTable(endpoint['请求参数'], method === 'GET' ? 'query' : 'body'))
    if (endpoint['请求参数']['约束']) append(`约束：${endpoint['请求参数']['约束']}`)
    if (Object.keys(endpoint['请求体约束']).length) append('对象级校验规则：', json(endpoint['请求体约束']))
    if (method === 'POST' && !path.endsWith('/views')) append('请求头：`Idempotency-Key`（必填）；同用户、同接口、同键在 24 小时内去重。')
    append('#### 请求示例', Object.keys(endpoint['请求示例']).length ? json(endpoint['请求示例']) : '无业务参数；携带通用认证请求头即可。', '示例中的路径参数、查询参数和请求体字段按上表“位置”分别传递；文件名仅作演示，实际上传文件字节。')
    append('#### 返回参数', fieldTable(endpoint['返回参数'], 'response'))
    append('#### 返回示例', json(endpoint['返回示例']))
    append('#### 可能的错误响应', '| HTTP状态 | 业务码 | 提示 |', '| --- | --- | --- |', ...endpoint['错误响应'].map(error => `| ${error.http_status} | ${error.code} | ${error.message} |`))
    const { http_status, ...errorExample } = endpoint['错误响应'].find(error => error.http_status !== 401) || endpoint['错误响应'][0]
    append(`错误示例（HTTP ${http_status}，JSON格式；下载失败同样返回JSON）：`, json(errorExample))
    append('#### 页面接入步骤', ...endpoint['接入流程'].map((step, index) => `${index + 1}. ${step}`))
    append('#### 设计批注')
    for (const [name, value] of Object.entries(endpoint['批注'])) append(`**${name}：**`, Array.isArray(value) ? value.join('、') || '无' : value)
  }
}
append('## 公共数据模型', '下列模型在返回参数表中按名称引用；必返字段允许 null 时已单独说明。')
for (const [name, fields] of Object.entries(source['数据模型'])) append(`### ${name}`, fieldTable(fields, 'response'))
append('## 建议数据表与关联', '以下为建议模型，尚未实施建表或数据库迁移。')
for (const table of source['建议数据表与关联']) {
  append(`### ${table['表']}`, `**用途：** ${table['用途']}`, `**主键：** \`${table['主键']}\``, '**关键字段：**', ...table['关键字段'].map(field => `- \`${field}\``))
  append('**关联关系：**', ...table['关联'].map(item => `- ${item}`))
  if (table['约束索引']) append('**约束与索引：**', ...table['约束索引'].map(item => `- ${item}`))
}
append('## 核心业务链路')
for (const [name, value] of Object.entries(source['核心业务链路'])) append(`### ${name}`, value)
append('## 验收检查', ...source['验收检查'].map(item => `- [ ] ${item}`))
fs.writeFileSync(new URL('../docs/api-design.md', import.meta.url), `${lines.join('\n')}\n`)
fs.writeFileSync(new URL('../docs/api-design.json', import.meta.url), `${JSON.stringify(source, null, 2)}\n`)
console.log(`已生成 Markdown：${count} 个接口、${source['页面模块'].length} 个模块`)
