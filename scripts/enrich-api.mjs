import { revise } from './revise-api.mjs'

const glossary = {
  id: ['记录编号', '服务端生成的唯一标识；作为字符串传输，前端不要转成数字。'],
  name: ['显示名称', '用于页面展示；个人资料中表示姓名，简历模型中表示原始文件名。'],
  job_direction: ['求职方向', '侧栏和设置页展示的岗位方向，例如Java后端开发。'],
  version_id: ['当前简历版本编号', '指向当前使用的文件及解析内容；与简历本身的编号不同。'],
  file_type: ['简历文件类型', 'PDF、DOC、DOCX分别表示对应的文档格式，用于文件图标展示。'],
  size_bytes: ['文件大小', '单位为字节，1024字节为1KiB；用于校验上传大小。'],
  updated_at: ['最后更新时间', '使用UTC时间，前端换算成用户时区后展示为“2天前”等。'],
  tags: ['简历技术标签', '从简历中提取的技能词，例如Java、Redis；解析前可以为空数组。'],
  is_active: ['是否为当前生效简历', 'true表示后续新建AI任务默认使用它；同一用户最多一份生效简历。'],
  parse_status: ['简历解析状态', 'pending=等待解析，processing=解析中，succeeded=解析成功，failed=解析失败；只有成功的简历可用于AI回答。'],
  parse_error: ['解析失败原因', '解析成功或尚未失败时为null；失败时返回适合用户阅读的原因。'],
  interview_id: ['所属面试记录编号', '将题目与某一场面试关联，不能用其他面试的题目填充当前详情。'],
  text: ['面试题内容', '展示题干原文，不包含答案；保存时去掉首尾空白。'],
  category: ['问题类别', 'technical=技术问题，hr=人资问题，unclassified=尚未分类。'],
  level: ['题目展示标签', 'frequent=高频，advanced=进阶，common=常见，unclassified=待分类；当前标签混合频率和难度。'],
  classification_status: ['自动分类处理状态', 'pending=等待识别，succeeded=识别完成，failed=识别失败；失败不影响已保存题目的查看。'],
  company: ['面试公司名称', '用户填写的公司展示名，例如字节跳动；当前不依赖公司字典表。'],
  city: ['面试所在城市', '例如北京；未填写时返回null，前端显示“未填写”。'],
  salary: ['薪资范围', '保留用户输入文本，例如25–40K；未填写时返回null，不参与数值计算。'],
  author_name: ['发布者昵称', '用于公开题目卡片展示，不返回发布者的邮箱、手机号或简历内容。'],
  views: ['累计有效浏览次数', '按每人每天同一道题最多一次计数，排除作者本人；不同于帮助人数。'],
  created_at: ['创建时间', 'ISO 8601 UTC时间；列表使用创建时间与编号组合排序。'],
  role: ['面试岗位名称', '例如后端开发工程师；当前弹窗没有输入框时默认“待补充职位”。'],
  interview_date: ['实际面试日期', '格式YYYY-MM-DD；未提交时取用户时区当天，不使用UTC日期直接替代。'],
  status: ['处理或业务状态', '含义取决于模型；面经表示面试进展，AI回答和批量任务表示后台处理进度。'],
  is_public: ['是否公开分享题目', 'true允许其他用户在公开题库看到本场题目；不会公开简历或个性化答案。'],
  question_count: ['题目总数', '本场面试实际保存的题目数量，包含尚未自动分类的题目。'],
  question_id: ['来源题目编号', '从题库或面经发起回答时使用；自由提问、文件题单生成的答案可为null。'],
  question_text: ['提问原文', '自由提问直接提交文本；答案响应保存生成时的题干快照，避免来源变化影响追溯。'],
  resume_id: ['简历编号', '标识一份逻辑简历，必须属于当前登录用户。'],
  resume: ['本次上传的简历', '返回新建简历的编号、文件信息、生效状态和解析进度，前端可直接新增卡片。'],
  resume_version_id: ['回答依据的简历版本编号', '创建任务时固定，后续切换生效简历不会改变本任务的回答依据。'],
  content: ['AI参考回答正文', '生成成功后返回第一人称回答；排队、处理中或失败时允许为null。'],
  suggestions: ['推荐问题或回答建议', '咨询页是可直接点击提问的问题；答案模型中是帮助完善回答的建议。'],
  error_code: ['任务失败业务码', '例如MODEL_TIMEOUT；未失败时为null，前端据此展示失败原因。'],
  file_name: ['题单文件名', '用户上传的原始文件名，用于页面识别任务。'],
  total: ['全部项目数量', '详情统计表示题目总数；批量任务表示有效题目总数。'],
  succeeded: ['成功作答数量', '成功生成答案的题目数，不能超过total。'],
  failed: ['失败作答数量', '已经确定失败的题目数；未处理题目不计入失败数。'],
  download_ready: ['是否可以下载结果', '只有结果文件生成并保存成功后为true；题目处理结束不代表文件已可下载。'],
  user: ['当前用户简要资料', '一次返回侧栏和问候语所需信息，避免页面再单独查询用户资料。'],
  active_resume: ['当前生效简历', '包含文件名、版本和解析状态；用户未上传或未激活简历时为null。'],
  resumes: ['首页简历卡片列表', '最多返回3条，优先包含当前生效简历；完整列表在简历管理页分页查询。'],
  public_questions: ['首页公开题目推荐', '最多返回3条真实公开题目，附带公司、城市、作者和浏览量。'],
  cursor: ['下一页查询游标', '首次不传；翻页原样传上次返回的next_cursor；改变筛选条件后清空。'],
  limit: ['每页条数', '默认20，范围1～100；不控制首页固定3条摘要。'],
  items: ['当前页列表', '元素结构见对应数据模型；有数据时返回对象数组，无数据时返回[]。'],
  next_cursor: ['下一页游标', '为null表示已到最后一页，前端应停止加载更多。'],
  file: ['上传文件', '通过multipart/form-data的文件字段传输真实字节，不是本地路径字符串。'],
  active_resume_id: ['切换后的生效简历编号', '前端用此编号更新所有卡片的选中状态，无须逐个请求保存。'],
  answer: ['AI回答详情', '同时包含状态、问题、依据简历、正文和建议。'],
  answer_id: ['AI回答任务编号', '创建回答后使用该编号查询进度，仅创建者可以访问。'],
  upload_rules: ['服务端上传规则', '页面据此展示支持格式、文件大小、表头和题目数量上限。'],
  extensions: ['允许的文件扩展名', 'xls、xlsx、csv；服务端仍须检查实际内容，不能只检查扩展名。'],
  max_bytes: ['文件大小上限', '单位字节；题单为10485760字节，即10MiB。'],
  required_column: ['必须存在的表头名称', '表格第一工作表中必须有“问题”列，空白问题行会被忽略。'],
  max_questions: ['单次有效题目上限', '建议200道，超过时拒绝创建任务，防止一次处理过多。'],
  latest_job: ['当前用户最近一次批量任务', '刷新页面后用它恢复进度；从未创建任务时为null。'],
  job: ['批量答题任务详情', '整份题单共用一个任务编号，前端不需要逐道题查询进度。'],
  job_id: ['批量任务编号', '用于查询进度和下载结果；仅任务创建者可以访问。'],
  body: ['下载文件内容', '实际响应为二进制流，示例中的文字仅说明文件内容，不是JSON响应。'],
  categories: ['页面分类选项', 'all=全部，technical=技术问题，hr=人资问题；全部查询时不传category。'],
  keyword: ['公司或题目搜索词', '例如Redis或字节；最多100字，前端输入后延迟约300毫秒再查询。'],
  counted: ['本次浏览是否计入次数', 'true为首次有效浏览；同人同日重复打开或作者自览为false。'],
  stats: ['用户面经汇总统计', '汇总当前用户所有记录，不只统计当前分页的数据。'],
  interview_count: ['已记录面试场数', '当前用户保存的面试记录总数。'],
  new_this_month: ['本月新增面试场数', '按创建时间及用户时区计算本月新增记录，不按面试日期倒推。'],
  technical_ratio: ['技术问题占比', '技术题数除以全部题数，返回0～1的小数；前端乘100展示百分比。'],
  public_question_count: ['公开分享题目数', '统计is_public=true面经下的题目数量，不是公开面试场数。'],
  helped_user_count: ['帮助过的用户人数', '所有公开题目的浏览者按用户去重，排除自己；同一个人浏览多题只算1人。'],
  interview: ['单场面试信息', '公司、岗位、日期、公开状态及题数的完整摘要。'],
  summary: ['本场题目分类统计', '总数必须等于技术题、人资题和待分类题数量之和。'],
  technical: ['技术题数量', 'category=technical的题目数量。'],
  hr: ['人资题数量', 'category=hr的题目数量。'],
  unclassified: ['待分类题目数量', '尚未识别或识别失败仍未分类的题目数，不应误计入技术题。'],
  questions: ['本场问题集合', '保存与追加接口传题干字符串数组；详情接口返回Question对象数组，按记录顺序排列。'],
  category_mode: ['题目分类方式', 'auto=后台自动识别每道题；technical或hr表示本次提交的题目统一按指定类别保存。'],
  question_ids: ['本次创建的题目编号列表', '顺序与提交题干一致，供前端定位新保存的问题。'],
  target_cities: ['目标求职城市', '字符串数组，例如["北京","杭州"]；保存前去重。'],
  notification_preference: ['消息提醒偏好', 'important=仅重要消息，all=全部消息，off=关闭消息。'],
  timezone: ['用户所在时区', 'IANA时区名，例如Asia/Shanghai，用于日期和月统计；当前设置页不提供修改入口。'],
  format: ['模板文件格式', 'xlsx=Excel工作簿，csv=带UTF-8 BOM的文本表格；不传默认xlsx。']
}

function annotate(fields) {
  for (const [name, field] of Object.entries(fields)) {
    if (typeof field !== 'object') continue
    const entry = glossary[name]
    if (!entry) throw new Error(`字段缺少说明：${name}`)
    field['原始说明'] ??= field.description || ''
    field['字段说明'] = entry[0]
    field['字段注释'] = [entry[1], field['原始说明']].filter(Boolean).join(' ')
    field.description = `${field['字段说明']}。${field['字段注释']}`
    if (field.properties) annotate(field.properties)
  }
}

const workflows = [
  ['用户打开首页时调用。页面同时需要姓名、生效简历、简历卡片和公开题目，所以一次返回这四块数据。这样用户不用等待多个请求陆续完成，也不会出现卡片已更新、简历提示却仍是旧值的情况。', ['确认当前登录用户是谁，读取姓名和求职方向。', '通过用户保存的生效简历编号找到简历，再读取它的当前版本和解析状态。', '读取最多3份用户简历，以及最新3道公开题目；把公司和作者信息一起查出。', '把四块数据放进同一个data返回；没有记录时返回空集合，不伪造统计或题目。']],
  ['用户进入“我的简历”时调用。顶部要显示正在使用哪份简历，下方要列出其他简历，因此两部分一起返回。即使翻到下一页，顶部仍能展示当前简历。', ['先确定用户正在使用的简历，读取文件名称和解析状态。', '按用户编号查询本页简历，只读取用户自己的资料。', '给每条简历补齐版本、技术标签和是否生效；生成下一页游标。', '前端显示卡片；存在待解析文件时隔几秒刷新，全部解析结束后停止。']],
  ['用户选择新简历后，页面希望立即看到新卡片并将它设为当前简历。文件保存与生效切换一次完成；简历内容解析可能较慢，放到后台处理，上传请求无需一直等待。', ['检查实际文件类型和大小，拒绝超限或伪造类型的文件。', '将原文件存到只有用户本人可以访问的文件存储中，保存文件记录。', '在同一个数据库事务中创建简历及版本，更新用户的生效简历编号，并登记解析任务；任一步失败则撤销本次数据库写入。', '立即返回pending状态；后台提取项目经历和技术标签，成功后改为succeeded，失败则记录原因。']],
  ['用户点击某张简历卡片，表示接下来生成的回答要使用它。只需修改用户“正在使用哪份简历”的编号，不必把所有简历逐个更新，也不会同时选中多份。', ['校验目标简历存在且属于当前用户。', '锁定当前用户记录，避免两个切换请求同时覆盖产生不确定结果，然后更新生效编号。', '返回最终生效简历及版本编号，前端更新选中效果。', '如果新简历还没解析完成，可以选中但暂不能提问；已经开始的回答继续使用创建时固定的版本。']],
  ['用户进入AI咨询页，需要知道“AI接下来参考哪份简历”，并看到几个可点击的推荐问题。这些是同一页的初始化内容，一次返回即可；推荐问题只是提问入口，不需要调用AI生成答案。', ['从当前用户记录取得active_resume_id，例如r1。', '用r1找到resumes记录，再用其current_version_id找到解析版本rv1，取得文件名和是否可用。', '从服务端配置读取推荐问题，例如“如何保证缓存一致性？”，与简历一起返回。', '前端展示“基于林知远_Java开发.pdf”；如果active_resume为null，则提示先上传简历，而不是直接读取不存在的文件名。']],
  ['首页提问、题库“查看回答”和面经“AI生成回答”做的都是同一件事：结合当前用户简历回答一道题，所以共用一个创建接口。AI耗时较长，先返回任务编号，页面显示“生成中”，再查询结果。', ['自由提问传question_text；题库提问传question_id，两者只能选一个。使用题目编号时先检查题目是否公开或属于当前用户。', '检查生效简历已解析成功，记录当前版本编号和题干快照，之后用户切换简历也不会影响这次回答。', '创建仅当前用户可见的回答记录，并登记后台任务；重复提交同一幂等键时不重复生成。', '后台根据真实项目经历组织回答，完成后保存正文和建议；模型超时或失败时保存错误码供页面提示。']],
  ['页面已经有回答任务编号，需要知道答案是否生成完。一个响应同时返回处理状态、正文和改进建议，避免分别请求状态和内容。这个接口只取已有结果，不会再次触发模型生成。', ['校验回答属于当前用户，不能读取其他人的个性化答案。', '读取回答状态和内容；排队或处理中时正文为null。', '成功后返回完整正文和建议；失败则返回failed及错误码。', '页面在处理中短暂等待后再查，逐步拉长间隔；成功或失败就停止查询。']],
  ['用户打开批量答题页，需要看到参考简历、文件要求，以及上次任务是否还在进行。把这三部分一起返回，刷新页面后也能继续查看进度，而不是误以为必须重新上传。', ['读取用户当前生效简历及解析状态。', '从统一配置取得支持格式、最大文件大小、问题列表头和数量上限。', '读取当前用户最近一份批量任务；从未上传则返回null。', '前端据状态恢复上传、生成中或可下载的步骤提示；进行中的任务继续查询任务进度。']],
  ['用户上传一整份题单，只应创建一个批量任务。浏览器不需要给每道题单独发生成请求；后台控制同时处理的数量，既能提升速度，也能避免大量请求把AI服务压垮。', ['检查当前简历可用，再校验文件格式、大小及第一工作表是否包含“问题”列。', '按原始行号提取有效题目，忽略空题，检查总数不超过200；保存原始行以便导出时保留其他列。', '一次保存整份任务和所有行记录，固定简历版本，然后由后台有限并发地生成答案。', '每行单独记录成功或失败，全部处理完后生成结果Excel；部分失败也保留成功答案和失败原因。']],
  ['用户等待整份题单完成时，只需要总体进度和下载是否就绪，不需要逐题查询。一次返回总数、成功数和失败数，页面即可显示进度。', ['确认任务属于当前用户。', '读取任务状态、总题数、成功数和失败数，不在查询时重新运行AI。', '题目全部处理后还要等待结果文件生成；只有文件可用才返回download_ready=true。', '例如2题中1题成功、1题失败，文件生成后状态为partial_failed，用户仍可下载查看失败原因。']],
  ['用户点击下载后才传输结果文件，查询进度时不反复带上整份Excel，节省网络流量。下载文件保留原题单内容，并追加答案、状态及错误原因列。', ['按任务编号检查归属，不能下载其他用户的文件。', '确认download_ready=true，尚未就绪时返回409提示稍后再试。', '根据任务的result_file_id查到私有存储中的结果文件，读取并返回字节流。', '浏览器携带认证信息下载为Blob，再保存成xlsx；失败题目的答案单元格留空，错误原因列写明原因。']],
  ['用户进入题库、切换分类或输入搜索词时调用。每张卡片需要题干、公司、城市、薪资、作者和浏览量，所以列表直接返回完整卡片，前端不用一张卡片再查一次公司或作者。', ['只选择允许公开分享的面经及其题目。', '按技术/人资类别和公司或题目关键词筛选；全部分类不传category。', '批量查询本页题目的面经和作者信息，按稳定顺序返回列表及下一页游标。', '筛选改变时前端清空旧游标；没有结果显示空列表；私人简历和个性化答案不随题库返回。']],
  ['用户实际打开某道公开题目的回答入口时，才认为浏览过该题，而不是滚动列表看到卡片就加次数。同一个人同一天反复打开只算一次，防止浏览量被重复刷新放大。', ['检查题目确实公开，并找到所属面经及作者。', '作者自己打开不计数；其他用户按题目、用户、UTC日期判断当天是否已经浏览。', '第一次浏览写入记录并增加题目views，重复浏览只返回当前次数。', '“帮助人数”另按浏览用户去重，例如一人看了作者的3道题仍只算帮助1人。']],
  ['“我的面经”页上方统计卡片和下方记录列表属于同一页面，因此一次返回。统计覆盖用户的全部记录，不因列表翻到第二页就改变总数。', ['只读取当前用户的面经，统计记录总场数和本月新建场数。', '统计所有关联题目总数、技术题比例和公开题目数。', '从公开题目的有效浏览记录中去重用户，得到帮助人数。', '再查询本页面经卡片及题数，把统计和列表一起返回；大数据量时可缓存统计，但必须明确更新时机。']],
  ['用户点击某场面试后，一屏要展示公司岗位、题目总数、分类数量和全部题干。一次返回这些内容，避免先显示详情头部再等待多个统计请求。', ['先按面经编号查询记录，并验证它属于当前用户。', '只读取这场面试关联的题目，按记录顺序排列，不能借用公开题库的其他题。', '数出技术、人资和待分类题的数量，保证三者之和等于题目总数。', '把面经信息、统计和题目一起返回；后台分类尚未完成时明确标为待分类。']],
  ['用户填写公司并输入多道题后点击保存，希望整场面试一次保存成功。公司信息和所有题目一起提交，一起成功或一起失败，不会出现只保存公司却丢失部分题目的半成品。', ['前端把手填的每行题目或Excel“问题”列整理成字符串数组，提交公司、城市、薪资、公开选项和分类方式。', '服务端校验公司必填、题目非空及数量上限，开始事务创建面经并批量写入题目。', '手选类别直接保存；选择自动识别时先存为待分类，再登记后台分类任务，保存操作不必等待AI。', '公开选项保存在面经上，旗下所有题目继承；保存成功关闭弹窗并刷新当前页面，AI分类失败也不丢失原题。']],
  ['用户复盘时可能想起漏记的题，需要给已有面试补充多道题。一次提交一组题目，沿用原面经的公司和公开状态，不再重新创建一场面试。', ['检查当前用户拥有这场面经，并校验新增题目内容。', '锁定面经记录，检查加上已有题目后不超过200道，避免两个同时追加的请求突破限制。', '给新增题目依次分配位置并一次写入；自动分类时登记后台任务。', '返回新增题目编号和最终题数，页面刷新详情后即可显示新题与更新后的统计。']],
  ['用户进入设置页时，需要把已有姓名、求职方向、目标城市和消息偏好填入表单。这些字段虽保存在两张表里，对页面而言仍是一份资料，所以一个接口一起返回。', ['从users读取姓名和求职方向。', '从user_settings读取目标城市、消息偏好和时区；没有设置记录时补默认值。', '把两张表的数据合成一份表单数据返回，城市用数组而不是用顿号拼接的字符串。', '前端将数组显示为可编辑城市列表，并把偏好枚举翻译成“重要消息”“全部消息”或“关闭”。']],
  ['用户修改资料后点一次保存，姓名和偏好应一起生效。接口只更新提交的字段，未提交的资料保留；返回保存后的完整资料，前端可直接同步侧栏姓名而不用再查一次。', ['校验字段白名单、姓名长度、城市数量和提醒偏好；城市去掉重复项。', '在一个事务中更新users资料和user_settings偏好，任一步失败则整体撤销。', '如果修改了公开显示的昵称，让相关题目卡片的缓存失效。', '返回最终表单值；当前前端占位输入需要先绑定真实表单状态，再接入此接口。']],
  ['批量答题和记录面试导入都要求“问题”列，共用一份模板可以避免用户下载到两种互不兼容的表格。模板属于小文件，不需要读取业务数据库。', ['根据format选择xlsx或csv，未传时默认xlsx。', '生成首列标题“问题”，填入一条示例题，方便用户照着填写。', '以附件形式返回；CSV使用UTF-8 BOM，减少Excel打开中文乱码的可能。', '导入时服务端仍检查表头和内容；模板下载成功不代表用户上传的任意文件都能被接受。']]
]

export function enrich(source) {
  for (const fields of Object.values(source['数据模型'])) annotate(fields)
  source['数据模型'].Interview.status['字段注释'] = 'recorded=已记录，second_round_completed=二面完成，awaiting_result=等待结果，closed=已结束。'
  source['数据模型'].Answer.status['字段注释'] = 'queued=排队中，running=生成中，succeeded=生成成功，failed=生成失败。'
  source['数据模型'].BatchJob.status['字段注释'] = 'queued=排队中，running=处理中，succeeded=全部成功，partial_failed=部分题目失败，failed=整份任务失败。'
  for (const model of ['Interview', 'Answer', 'BatchJob']) source['数据模型'][model].status.description = `${source['数据模型'][model].status['字段说明']}。${source['数据模型'][model].status['字段注释']}`
  let index = 0
  for (const module of source['页面模块']) {
    for (const endpoint of module['接口']) {
      annotate(endpoint['请求参数'])
      annotate(endpoint['返回参数'])
      const [idea, steps] = workflows[index++]
      endpoint['批注']['设计思路'] = idea
      endpoint['批注']['实现逻辑'] = steps.map((step, position) => `${position + 1}. ${step}`).join('\n')
      endpoint['批注']['表关系举例'] = relationExample(endpoint['批注']['数据表'])
    }
  }
  populateExamples(source)
  return revise(source)
}

function relationExample(tables) {
  if (tables.includes('batch_jobs')) return '例如用户u1上传题单形成任务b1，batch_jobs保存b1的上传文件和简历版本rv1；batch_job_items保存b1中每道题，answer_id对应ai_answers中的答案；结果生成后，b1的result_file_id指向files中的Excel文件。'
  if (tables.includes('ai_answers')) return '例如回答a1属于用户u1，使用简历r1的版本rv1；ai_answers.resume_version_id=rv1。用户改用r2后，a1仍可追溯到rv1，不会突然变成依据r2生成。'
  if (tables.includes('question_views')) return '例如面经i1属于用户u1，题目q1属于i1；用户u2打开q1时，在question_views记录q1与u2的关系。通过题目再找到面经，就知道这次浏览帮助的是哪位作者。'
  if (tables.includes('questions')) return '例如用户u1记录面经i1，再保存题目q1和q2：interviews.user_id=u1，questions.interview_id=i1。一场面试有多道题，每道题只属于一场面试；公开属性由面经统一决定。'
  if (tables.includes('resumes')) return '例如用户u1正在使用简历r1：users.active_resume_id=r1；简历r1的当前版本为rv1：resumes.current_version_id=rv1；resume_versions.resume_id=r1。先找用户，再找简历，最后找版本内容，三个编号代表不同层次。'
  if (tables.includes('user_settings')) return '例如用户编号为u1，users.id=u1，user_settings.user_id也为u1。users保存姓名和岗位方向，user_settings保存同一个人的城市与提醒偏好。'
  return '此接口使用固定模板文件，不需要业务数据表，也没有表之间的关联。'
}

function populateExamples(source) {
  const endpoints = source['页面模块'].flatMap(module => module['接口'])
  const resume = structuredClone(endpoints[2]['返回示例'].data.resume)
  Object.assign(resume, { tags: ['Java', 'Spring Boot', 'Redis'], parse_status: 'succeeded' })
  const question = structuredClone(endpoints[11]['返回示例'].data.items[0])
  const interview = structuredClone(endpoints[14]['返回示例'].data.interview)
  Object.assign(interview, { role: '后端开发工程师', question_count: 2 })
  const secondQuestion = { ...question, id: 'q2', text: '请介绍一次项目中遇到的挑战及解决过程。', category: 'hr', level: 'common', views: 185 }
  const finishedAnswer = structuredClone(endpoints[6]['返回示例'].data.answer)
  finishedAnswer.content = '在我的项目中，我把数据库作为订单状态的最终依据。更新订单时先提交数据库事务，再删除对应缓存；如果删除失败，则记录任务并重试。对允许短暂延迟的查询，我会配合缓存过期时间减少旧值长期存在的风险。对必须准确的状态判断，我会直接读取数据库。面试时我会结合实际项目说明并发更新可能出现的竞态，以及采用补偿方案的原因。'
  const job = { id: 'b1', file_name: '后端面试题.xlsx', resume_id: 'r1', resume_version_id: 'rv1', status: 'running', total: 2, succeeded: 1, failed: 0, download_ready: false, error_code: null }
  Object.assign(endpoints[0]['返回示例'].data, { active_resume: resume, resumes: [resume], public_questions: [question, secondQuestion] })
  Object.assign(endpoints[1]['返回示例'].data, { active_resume: resume, items: [resume] })
  endpoints[4]['返回示例'].data.active_resume = resume
  endpoints[6]['返回示例'].data.answer = finishedAnswer
  Object.assign(endpoints[7]['返回示例'].data, { active_resume: resume, latest_job: job })
  Object.assign(endpoints[13]['返回示例'].data, { stats: { interview_count: 1, new_this_month: 1, question_count: 2, technical_ratio: 0.5, public_question_count: 2, helped_user_count: 126 }, items: [interview] })
  Object.assign(endpoints[14]['返回示例'].data, { interview, summary: { total: 2, technical: 1, hr: 1, unclassified: 0 }, questions: [question, secondQuestion] })
  endpoints[15]['返回示例'].data.interview.question_count = 2
  endpoints[15]['返回示例'].data.question_ids = ['q1', 'q2']
  endpoints[16]['返回示例'].data.question_ids = ['q3', 'q4']
  endpoints[16]['返回示例'].data.question_count = 4
  const samples = { resume_id: 'r1', question_id: 'q1', question_text: '如何保证缓存一致性？', answer_id: 'a1', job_id: 'b1', interview_id: 'i1', category: 'technical', keyword: '缓存', limit: 20, cursor: 'eyJpZCI6InExMCJ9', company: '字节跳动', city: '北京', salary: '25–40K', role: '后端开发工程师', interview_date: '2026-10-22', category_mode: 'auto', is_public: true, questions: ['如何保证缓存一致性？', '请介绍一次项目中遇到的挑战及解决过程。'], name: '林知远', job_direction: 'Java 后端开发', target_cities: ['北京', '杭州'], notification_preference: 'important', format: 'csv' }
  for (const endpoint of endpoints) {
    const fields = Object.entries(endpoint['请求参数']).filter(([, field]) => typeof field === 'object')
    const sample = Object.fromEntries(fields.filter(([name]) => name !== 'cursor').map(([name]) => [name, name === 'file' ? (endpoint['路径'] === '/api/v1/resumes' ? '林知远_Java开发.pdf（实际传文件字节）' : '后端面试题.xlsx（实际传文件字节）') : samples[name]]))
    if (sample.question_id && sample.question_text) delete sample.question_text
    endpoint['请求示例'] = sample
    for (const [name, field] of fields) if (name !== 'file') field.example = samples[name]
  }
  source['模拟数据说明'] = '示例均为模拟数据，各接口展示不同操作时点：上传返回待解析，页面展示解析成功，保存面经返回待分类，详情展示分类完成；业务上允许null的错误原因、处理中正文和末页游标仍保留null。'
}
