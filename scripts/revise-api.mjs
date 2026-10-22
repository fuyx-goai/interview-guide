const errors = {
  INVALID_ARGUMENT: [400, '请求参数不符合要求，请检查字段和取值'],
  INVALID_FILE_CONTENT: [400, '未找到有效的问题列，或题目数量超过限制'],
  UNAUTHENTICATED: [401, '登录已失效，请重新登录'],
  RESOURCE_NOT_FOUND: [404, '记录不存在或当前用户不可见'],
  IDEMPOTENCY_CONFLICT: [409, '同一个幂等键不能提交不同内容'],
  IDEMPOTENCY_IN_PROGRESS: [409, '原请求仍在处理中，请使用同一幂等键稍后重试'],
  NO_ACTIVE_RESUME: [409, '请先上传并选择生效简历'],
  RESULT_NOT_READY: [409, '结果文件尚未生成，请稍后下载'],
  FILE_TOO_LARGE: [413, '上传文件超过允许大小'],
  UNSUPPORTED_FILE_TYPE: [415, '不支持该文件类型，请按页面提示选择文件'],
  RESUME_NOT_READY: [422, '当前简历尚未解析成功，请等待解析或更换简历'],
  RATE_LIMITED: [429, '操作过于频繁，请稍后重试'],
  SERVICE_UNAVAILABLE: [503, '服务暂时不可用，请稍后重试']
}

const mapping = [
  ['r.type', 'file_type', '按PDF、DOC、DOCX展示，DOC和DOCX共用文档图标'],
  ['r.active', 'is_active', '切换成功后统一更新选中项；失败保留原生效项'],
  ['r.date', 'updated_at', '将UTC时间转成本地相对时间，不由后端返回“2天前”'],
  ['r.parsed', 'parse_status', '替换为四态展示，不能用一个布尔值代表解析中和失败'],
  ['q.type / filter', 'category', 'technical=技术问题；hr=人资问题；unclassified=待分类；全部查询不传category'],
  ['q.level', 'level', 'frequent=高频；advanced=进阶；common=常见；unclassified=待分类'],
  ['q.author', 'author_name', '公开昵称直接用于发布者文案'],
  ['i.date / i.count', 'interview_date / question_count', '日期展示为YYYY.MM.DD，题数直接读取question_count'],
  ['i.status', 'Interview.status', 'recorded=已记录；second_round_completed=二面完成；awaiting_result=等待结果；closed=已结束'],
  ['initial / color', 'company', '前端取公司名首字，按固定哈希选择已有配色，无须补查接口'],
  ['姓名、岗位及头像首字', 'user.name / user.job_direction', '首页初始化后保存到共享状态；设置保存成功后同步，替换硬编码值'],
  ['目标城市输入框', 'target_cities', '读取时数组用顿号展示；提交时按中英文逗号、顿号分隔、trim并去重'],
  ['消息通知选项', 'notification_preference', '重要消息=important；全部消息=all；关闭=off'],
  ['面经统计卡片', 'stats', '绑定真实返回值；technical_ratio乘100显示百分比，不能继续使用固定8、46、21']
]

const flows = {
  '首页': [
    '进入首页仅GET /api/v1/pages/home一次；分别绑定user、active_resume、resumes、public_questions，卡片关联信息已齐全，不再逐卡片补查。',
    'active_resume是生效来源，null时显示“请先上传并选择简历”，禁止访问.name或回退选中列表第一项；非succeeded时展示等待、解析中或失败提示并禁用AI提交。',
    '首页自由提问只传question_text创建回答，成功取得answer.id后切到咨询页继续同一任务；不再因进入咨询页重复POST。上传、切换或保存面经成功后使相关摘要失效。'
  ],
  '我的简历': [
    'GET /api/v1/pages/resumes加载首屏；增加“加载更多”，首次不传cursor，后续传next_cursor并按ID追加去重；null时隐藏按钮。',
    '上传成功后直接加入返回卡片，并同步唯一生效编号；解析状态pending/processing时每3秒刷新对应已加载页，按ID合并变化，不能用第一页覆盖已加载的其他页。',
    '同时检查active_resume及全部已加载卡片的解析状态；隐藏页面暂停查询，全部终态停止。最长自动等待2分钟，超时显示“仍在处理，可手动刷新”，不把超时当作后台失败。',
    '切换成功才更新共享生效项，失败保留旧选择；已创建回答保持原resume_version_id，不能改成新简历生成的答案。'
  ],
  'AI 面试咨询与查看回答弹窗': [
    '咨询页GET /api/v1/pages/consultation获取当前简历与建议；自由提问只传question_text，题库或面经入口只传question_id，二者必须且只能传一个。',
    '点击后立即显示生成中并禁用重复提交；POST成功记录answer.id，首次1秒后查询，随后2、4、5秒退避。queued/running继续，succeeded显示content和suggestions，failed显示error_code及重试按钮。',
    '自动轮询最多2分钟，达到上限保留任务编号并提供“继续查询”，后台不被取消。401停止所有轮询；429或503延后重试；404终止并提示不可见。',
    '点击“查看回答”先保留来源页并打开弹窗，只有点击“进入AI咨询”才跳转，同时带上现有任务编号，不重新创建答案。清空、关闭或换题时递增显示序号并停止旧轮询，只接收当前answer.id及显示序号匹配的响应。',
    '每次有意生成新答案用新Idempotency-Key；网络重试沿用原键和内容。失败任务重试是新操作，用新键重新POST。succeeded的正文必须非空；非成功时content=null；failed时error_code必有值。',
    '公开题目实际打开时可非阻塞POST浏览事件；面经详情仅interview.is_public=true时发送。浏览失败不影响回答，AI创建接口不再重复计数。'
  ],
  '批量答题': [
    'GET /api/v1/pages/batch-answers一次获取规则、当前简历与latest_job；先检查简历就绪，再POST原始文件创建任务，整个题单只创建一个任务。',
    '页面需绑定文件选择及拖放事件，补齐处理中、成功、部分失败、失败和下载入口；POST返回后保存job.id，每2秒查询一次并逐步退避至10秒。',
    'queued/running持续查询；最多自动等待10分钟，之后保留任务并提示手动刷新；隐藏页面暂停，重新进入用latest_job恢复。只查询任务，不逐题请求。',
    'succeeded/partial_failed且download_ready=true才启用下载；全部失败时status=failed且download_ready=false。按任务实际resume_id和resume_version_id显示依据，不把当前生效简历当作旧任务依据。',
    '统计遵循succeeded+failed<=total；全部终态时等于total。结果文件未准备好仍为running；文件生成失败则failed并记录错误。部分题目失败仍生成含错误原因的XLSX。',
    '下载成功按Content-Type读取Blob保存文件；非2xx按JSON错误解析，不能将错误响应当作xlsx。401停止，409等待进度，429退避；跨域服务允许Authorization和Idempotency-Key请求头，并暴露Content-Disposition响应头。'
  ],
  '公开题库': [
    'GET /api/v1/pages/question-bank返回分类和卡片；选择全部时省略category。输入关键词延迟300毫秒查询，旧查询结果不得覆盖新查询。',
    '增加“加载更多”；改变分类或关键词时清空cursor并替换列表；下一页按ID追加去重。不要把中文分类或all传给只接受technical/hr的查询参数。',
    '打开回答弹窗复用AI流程；不读取或公开发布者的简历及私人答案。公司首字、颜色和枚举中文在前端转换。'
  ],
  '我的面经': [
    'GET /api/v1/pages/interviews同时绑定统计和卡片，统计覆盖全部记录；列表增加加载更多，不能用本页条数计算总场数。',
    '点击卡片GET /api/v1/interviews/{interview_id}获取真实详情；绑定interview、summary、questions，禁止使用公开题库切片补题。',
    '记录面试弹窗只提交现有输入：company、city、salary、category_mode、is_public、questions；role与interview_date可不传，由后端填默认职位与用户当地日期。手填按行拆题，Excel浏览器解析后提交同一种字符串数组。',
    '所有题目一次提交；网络失败保留表单并复用幂等键重试，只有保存成功才关闭及重置。全局弹窗保存后使首页、题库、面经列表和详情缓存失效，切回相关页面重新GET。',
    '保存或追加返回pending时按当前interview_id有限轮询已有详情，2秒起、最长5秒，最长2分钟；逐题classification_status没有pending后停止。failed的题目保留原文及待分类标签，允许后续手动刷新。',
    '补充问题入口先增加输入与提交界面，再POST追加数组；成功刷新详情和相关统计。后台分类结束后失效首页、题库及统计缓存；本地其他页面标记过期，下一次进入时重取。'
  ],
  '设置': [
    'GET /api/v1/pages/settings后绑定四个真实表单字段；timezone只读，不提交。PATCH至少传一个可编辑字段，传入字段必须合法，未传字段保留。',
    '城市输入拆为数组并去重，消息选项转成枚举。保存成功用返回值更新表单及共享姓名和岗位，失败保留输入，禁止只显示保存成功提示。'
  ],
  '公共模板下载': [
    '两个入口复用GET /api/v1/templates/questions；format默认xlsx，也支持csv。当前弹窗已有本地CSV下载可以保留，只要问题列表头一致。',
    '成功按文件流保存，失败按JSON错误处理；此接口不要求Idempotency-Key，不读取简历或业务数据表。'
  ]
}

function setNote(field, title, note) {
  Object.assign(field, { '字段说明': title, '字段注释': note, description: `${title}。${note}` })
}

function constrainFields(fields) {
  const lengths = { company: [1, 100], name: [1, 50], job_direction: [1, 100], city: [1, 50], salary: [1, 100], role: [1, 100], keyword: [1, 100], question_text: [1, 4000] }
  for (const [name, field] of Object.entries(fields)) {
    if (typeof field !== 'object') continue
    if (lengths[name]) Object.assign(field, { minLength: lengths[name][0], maxLength: lengths[name][1] })
    if (name.endsWith('_id') || field['位置'] === 'path') field.minLength = 1
    if (name === 'interview_date') field.format = 'date'
    if (name === 'limit') field.default = 20
    if (name === 'cursor') Object.assign(field, { minLength: 1, maxLength: 2048 })
    if (name === 'format') field.default = 'xlsx'
    if (name === 'questions') Object.assign(field, { minItems: 1, maxItems: 200, items: { type: 'string', minLength: 1, maxLength: 4000 } })
    if (name === 'target_cities') Object.assign(field, { minItems: 0, maxItems: 20, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 50 } })
  }
}

function assignErrors(endpoint) {
  const names = ['UNAUTHENTICATED', 'RATE_LIMITED', 'SERVICE_UNAVAILABLE']
  const fields = endpoint['请求参数']
  if (Object.keys(fields).length) names.push('INVALID_ARGUMENT')
  if (Object.values(fields).some(field => field?.['位置'] === 'path') || fields.resume_id) names.push('RESOURCE_NOT_FOUND')
  if (endpoint['请求方式'] === 'POST' && !endpoint['路径'].endsWith('/views')) names.push('IDEMPOTENCY_CONFLICT', 'IDEMPOTENCY_IN_PROGRESS')
  if (fields.file) names.push('FILE_TOO_LARGE', 'UNSUPPORTED_FILE_TYPE')
  if (endpoint['路径'].endsWith('/batch-answer-jobs') || endpoint['路径'].endsWith('/ai/answers')) names.push('NO_ACTIVE_RESUME', 'RESUME_NOT_READY')
  if (endpoint['路径'].endsWith('/batch-answer-jobs')) names.push('INVALID_FILE_CONTENT')
  if (endpoint['路径'].endsWith('/result')) names.push('RESULT_NOT_READY')
  endpoint['错误响应'] = names.map(code => ({ http_status: errors[code][0], code, message: errors[code][1], request_id: `req_${code.toLowerCase()}`, data: null }))
}

function refineEndpoint(endpoint, flow) {
  constrainFields(endpoint['请求参数'])
  endpoint['接入流程'] = flow
  endpoint['请求体约束'] = {}
  if (endpoint['路径'].endsWith('/ai/answers')) endpoint['请求体约束'].oneOf = [{ required: ['question_id'] }, { required: ['question_text'] }]
  if (endpoint['请求方式'] === 'PATCH') endpoint['请求体约束'].minProperties = 1
  for (const field of Object.values(endpoint['请求参数'])) {
    if (field?.['位置'] === 'path') setNote(field, field['字段说明'], '必填、非空的资源编号；按路径替换，不放入请求体，不接受null。')
  }
  if (endpoint['路径'].endsWith('/ai/answers')) setNote(endpoint['请求参数'].question_id, '来源题目编号', '与question_text必须且只能提交一个；提交时必须是非空字符串，不接受null；题目必须公开或属于当前用户。')
  if (endpoint['路径'].endsWith('/question-bank')) setNote(endpoint['请求参数'].category, '题库筛选类别', '只接受technical（技术问题）或hr（人资问题）；选择全部时不传，不得传all或unclassified。')
  if (endpoint['路径'].endsWith('/active-resume')) setNote(endpoint['返回参数'].resume_version_id, '切换后的简历版本编号', '表示新生效简历的当前版本；尚未解析成功时不能新建AI任务，已开始的任务继续引用原版本。')
  if (endpoint['路径'].endsWith('/views')) endpoint['批注']['设计思路'] += ' 浏览事件是唯一计数入口；创建AI回答不再增加浏览次数。'
  if (endpoint['请求方式'] === 'POST' && endpoint['路径'].endsWith('/interviews')) {
    delete endpoint['请求示例'].role
    delete endpoint['请求示例'].interview_date
    endpoint['返回示例'].data.interview.role = '待补充职位'
  }
  assignErrors(endpoint)
}

export function revise(source) {
  source['版本'] = '1.1.0'
  source['状态'] = '按页面审查修订的建议接口契约，前后端尚未实现联调'
  source['页面字段映射'] = mapping
  source['接入规范'] = flows
  source['修订说明'] = {
    R1: '修复响应Schema重复转换，保留引用及所有层级必返约束。',
    R2: '明确采用统一前端适配层，列出字段、枚举、日期及空状态转换；应用代码尚待接入。',
    R3: '规定AI、批量、设置及补充问题的页面承接步骤与失败处理；不声称原型已经具备这些界面。',
    R4: '规定弹窗保留来源页，任务ID与显示序号共同隔离旧响应。',
    R5: '规定列表加载更多、筛选重置和状态轮询按ID合并。',
    R6: '补齐二选一、非空提交、字符长度、数组长度、格式、默认值及请求字段白名单。',
    R7: '保存示例只提交弹窗现有字段，默认岗位与响应一致。',
    R8: '按实际接口分配HTTP错误与业务码，补齐文件下载响应头。',
    R9: '规定分类状态查询、跨页缓存失效、共享生效简历同步和幂等重试。'
  }
  source['通用约定']['字段描述格式'] += ' 字符串使用minLength/maxLength，数组使用minItems/maxItems；default、format、uniqueItems同步导出为OpenAPI约束。'
  source['通用约定']['字段描述格式'] = source['通用约定']['字段描述格式'].replace(/ 字符串使用minLength\/maxLength，数组使用minItems\/maxItems；default、format、uniqueItems同步导出为OpenAPI约束。/g, '') + ' 字符串使用minLength/maxLength，数组使用minItems/maxItems；default、format、uniqueItems同步导出为OpenAPI约束。'
  source['通用约定']['对象兼容性'] = '请求体拒绝未声明字段，additionalProperties=false；响应允许新增字段，前端忽略不认识的字段，必返字段不得缺失。缺省字段与显式null不同：只在声明nullable时接收null。'
  source['通用约定']['输入规范'] = '文字输入先trim再校验，禁止纯空白题目、姓名或公司名。可选city、salary未填写时省略，不能提交空字符串；响应相应字段为null。字符上限按Unicode码点计算。单场追加后总题数必须由服务端在事务内再次校验。'
  source['通用约定']['错误处理'] = '越权与不存在统一404，不泄露私人资源是否存在；401停止轮询并提示重新登录；429按Retry-After等待；503退避重试。请求级错误用各接口错误响应；HTTP200下的任务failed是业务终态，读取任务error_code，不能误当作HTTP失败。'
  source['通用约定']['业务决定状态'] = '本次沿用原型的个性化生成语义及现有level展示标签，不扩展公开标准答案或难度字段。200题、首页3条及浏览去重口径仍为建议默认，需产品确认；确认前按本文一致实现Mock。'
  for (const module of source['页面模块']) {
    for (const endpoint of module['接口']) refineEndpoint(endpoint, flows[module['模块']])
  }
  return source
}
