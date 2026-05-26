import type { BuiltinGroupTemplate, BuiltinGroupTemplateRole } from '../group/builtinGroupTemplates'
import type { OpenTeamLanguage, RoleTemplate } from '../group/types'

export type TeamLanguage = OpenTeamLanguage

export const DEFAULT_LANGUAGE: TeamLanguage = 'en'

const UI_TRANSLATIONS: Record<string, string> = {
  '缩小窗口': 'Minimize window',
  '全屏窗口': 'Fullscreen window',
  '调整窗口大小': 'Resize window',
  'OpenTeam 导航': 'OpenTeam navigation',
  '群聊': 'Chats',
  '查看全部笔记': 'View all notes',
  '全部笔记': 'All notes',
  '打开人员库': 'Open people library',
  '人员库': 'People library',
  '添加大模型': 'Add model',
  '设置': 'Settings',
  '语言': 'Language',
  '加载群聊中': 'Loading chats',
  '还没有群聊': 'No chats yet',
  '在上方创建一个群聊，然后从人员库添加人员。': 'Create a chat above, then add people from the library.',
  '新建群聊': 'New chat',
  '编辑名称': 'Edit name',
  '复制群聊': 'Duplicate chat',
  '导出记录': 'Export records',
  '清空消息': 'Clear messages',
  '关闭群聊': 'Close chat',
  '删除群聊': 'Delete chat',
  '群聊名称': 'Chat name',
  '例如：产品方案讨论': 'Example: product proposal review',
  '群聊模式': 'Chat mode',
  '协作群聊': 'Collaborative chat',
  '协作群聊模式': 'Collaborative mode',
  '独立专家模式': 'Independent expert mode',
  '人员参考群聊上下文，适合接力讨论。': 'Members share chat context; good for sequential discussion.',
  '独立专家': 'Independent experts',
  '人员独立回答，适合并行评审。': 'Members answer independently; good for parallel review.',
  '取消': 'Cancel',
  '创建': 'Create',
  '从模板中创建': 'Create from template',
  '未选择群聊': 'No chat selected',
  '创建或选择一个群聊开始协作': 'Create or select a chat to start collaborating',
  '选择一个群聊': 'Select a chat',
  '左侧群聊列表会显示最近摘要、状态和更新时间。': 'The chat list on the left shows recent summaries, status, and update time.',
  '选择群聊后可添加、查看、恢复和唤醒人员。': 'Select a chat to add, view, restore, and wake people.',
  '点击添加人员，可从人员库批量加入或临时添加。': 'Click Add people to add from the library or add a temporary person.',
  '界面模式': 'Theme',
  '浅色模式': 'Light mode',
  '深色模式': 'Dark mode',
  '浅色': 'Light',
  '深色': 'Dark',
  '编排': 'Orchestration',
  '仅 @ 回复': 'Only @ replies',
  '@ 触发回复': '@ replies',
  '开启后，只有被 @ 的成员才会回复': 'When enabled, only mentioned members reply',
  '笔记': 'Notes',
  '空': 'Empty',
  '恢复会话': 'Restore session',
  '输入消息，@成员可指定回复；不 @ 仅记录到群聊。': 'Type a message. Mention @members to request replies; without @ it is saved to the chat.',
  '选择群聊后可发送': 'Select a chat to send',
  '发送': 'Send',
  '群聊成员与人员': 'Chat members and people',
  'AI 站点登录': 'AI site login',
  '当前群聊人员': 'Current chat people',
  '收起成员面板': 'Collapse people panel',
  '打开成员面板': 'Open people panel',
  '收起': 'Collapse',
  '添加人员': 'Add people',
  '从人员库批量选择，或临时添加只属于当前群聊的人员。': 'Choose from the people library, or add temporary people for this chat only.',
  '笔记面板': 'Notes panel',
  '拖动笔记': 'Drag notes',
  '手动记录或收集 Mark 内容。': 'Write notes manually or collect marked content.',
  '关闭笔记': 'Close notes',
  '笔记范围': 'Notes scope',
  '当前群聊': 'Current chat',
  '全局笔记': 'Global notes',
  '富文本工具栏': 'Rich-text toolbar',
  '加粗': 'Bold',
  '斜体': 'Italic',
  '删除线': 'Strikethrough',
  '项目列表': 'Bullet list',
  '编号列表': 'Numbered list',
  '撤销': 'Undo',
  '重做': 'Redo',
  '富文本笔记编辑器': 'Rich-text notes editor',
  '打开 OpenTeam': 'Open OpenTeam',
  '全局、群聊、已删除群聊': 'Global, chat, and deleted-chat notes',
  '关闭全部笔记': 'Close all notes',
  '还没有笔记': 'No notes yet',
  '群聊笔记': 'Chat note',
  '已删除群聊的笔记': 'Deleted-chat note',
  '手动记录': 'Manual note',
  '当前笔记富文本编辑器': 'Active note rich-text editor',
  '选择一个现成小组，创建后会自动加入模板人员。': 'Choose a ready-made group; template people will be added automatically.',
  '关闭群聊模板': 'Close chat templates',
  '搜索模板': 'Search templates',
  '搜索任务、行业、角色或模板名称，例如：写论文、合同、面试、AI Agent': 'Search tasks, industries, roles, or template names, e.g. paper, contract, interview, AI Agent',
  '群聊模板分类': 'Chat template categories',
  '群聊模板': 'Chat templates',
  '确认创建': 'Confirm create',
  '了解限制并创建': 'Acknowledge limits and create',
  '没有找到匹配的小组': 'No matching group found',
  '可以试试换个说法，例如搜索「写论文」「合同」「面试」「投放」「装修」。': 'Try another phrasing, such as paper, contract, interview, launch, or renovation.',
  '清空搜索': 'Clear search',
  '查看全部模板': 'View all templates',
  '专业边界': 'Professional boundary',
  '需谨慎': 'Use with care',
  '新群聊': 'New chat',
  '维护可复用人员人设；加入群聊后会复制为独立人员。': 'Manage reusable personas; adding them to a chat creates independent copies.',
  '新建': 'New',
  '关闭人员库': 'Close people library',
  '人员列表': 'People list',
  '搜索人员名称、描述或提示词': 'Search people names, descriptions, or prompts',
  '人员库类型': 'People library type',
  '自定义人员': 'Custom people',
  '内置人员': 'Built-in people',
  '人员分类': 'People categories',
  '不使用人员库，手动创建': 'Do not use the library; create manually',
  '内置': 'Built-in',
  '自定义': 'Custom',
  '详情': 'Details',
  '上一页': 'Previous',
  '下一页': 'Next',
  '未填写人员库描述': 'No people-library description',
  '未填写描述': 'No description',
  '所有可用站点已添加': 'All available sites have already been added',
  '临时人员': 'Temporary person',
  '可以切换到自定义人员，或调整搜索词。': 'Switch to custom people, or adjust the search terms.',
  '点击右上角新建人员，保存后会出现在这里。': 'Click New in the top right; saved people will appear here.',
  '先在人员库中新建人员，或点击右上角临时添加。': 'Create a person in the people library first, or use Add temporary in the top right.',
  '外部模型': 'External models',
  '配置 OpenAI 或 Anthropic 兼容 API，人员可直接选择这些模型。': 'Configure OpenAI or Anthropic-compatible APIs so people can use them directly.',
  '关闭外部模型': 'Close external models',
  '显示名称': 'Display name',
  '例如：本地模型': 'Example: local model',
  '接口格式': 'API format',
  'OpenAI 格式': 'OpenAI format',
  'Anthropic 格式': 'Anthropic format',
  '模型地址': 'Model URL',
  '模型 Key': 'Model key',
  '模型名称': 'Model name',
  '保存外部模型': 'Save external model',
  '新建人员': 'New person',
  '维护人员名称、人设和默认站点。': 'Manage the person name, persona, and default site.',
  '关闭人员编辑': 'Close person editor',
  '描述想要的人设': 'Describe the persona you want',
  '例如：一个擅长小红书增长的内容顾问': 'Example: a content growth advisor for Xiaohongshu',
  'AI 生成': 'Generate with AI',
  '生成中': 'Generating',
  '生成中...': 'Generating...',
  '已生成，可继续修改后保存': 'Generated. You can edit it before saving.',
  '请先描述想要生成的人设': 'Describe the persona you want to generate first',
  '人员名称': 'Person name',
  '描述': 'Description',
  '人设': 'Persona',
  '默认站点': 'Default site',
  'GPTs 链接前缀': 'GPTs link prefix',
  '选填。保存后，该人员使用 ChatGPT 时会优先打开这个 GPTs。': 'Optional. After saving, this person opens this GPT first when using ChatGPT.',
  'Grok 项目链接': 'Grok project URL',
  '选填。保存后，该人员使用 Grok 时会优先打开这个项目。': 'Optional. After saving, this person opens this project first when using Grok.',
  '保存人员': 'Save person',
  '系统内置人员': 'System built-in person',
  '关闭内置人员详情': 'Close built-in person details',
  '从人员库或临时草稿中选择人员，并为每个人指定站点。': 'Choose people from the library or temporary drafts, and assign a site to each.',
  '临时添加': 'Add temporary',
  '关闭添加人员': 'Close add people',
  '选择人员': 'Choose people',
  '当前群聊还没有人员': 'This chat has no people yet',
  '输入消息；不 @ 仅记录，@ 人员触发回复': 'Type a message; without @ it is recorded only, while @people triggers replies',
  '将作为群消息记录，不触发 AI；@ 人员可触发回复': 'This will be recorded as a chat message and will not trigger AI; @people can trigger replies',
  '取消引用': 'Cancel quote',
  '所有人': 'Everyone',
  '全员': 'All people',
  '本机智能体控制：开启': 'Local agent control: On',
  '本机智能体控制：关闭': 'Local agent control: Off',
  '尚未读取消息': 'No messages read yet',
  '等待连接': 'Waiting to connect',
  '网页已连接': 'Web connected',
  '连接 API': 'API connected',
  '待唤醒': 'Pending',
  '加载中': 'Loading',
  '在线': 'Online',
  '回复中': 'Replying',
  '已停止': 'Stopped',
  '异常': 'Error',
  '草稿': 'Draft',
  '初始化中': 'Initializing',
  '进行中': 'Active',
  '运行中': 'Running',
  '暂无成员': 'No members yet',
  '正在初始化角色': 'Initializing roles',
  '正在创建角色窗口，准备好后就可以继续对话。': 'Creating role windows. You can continue once they are ready.',
  '等待第一条消息': 'Waiting for the first message',
  '直接发送会记录消息；@ 人员或 @所有人 后触发回复。': 'Send directly to record a message; mention @people or @all to trigger replies.',
  '正在回复中': 'Replying',
  '已停止回复': 'Reply stopped',
  '停止回复': 'Stop reply',
  '重新回复': 'Retry reply',
  '重新发送': 'Resend',
  '跳转到原始窗口': 'Jump to source window',
  '重新同步完整回复': 'Resync full reply',
  '引用回复': 'Quote reply',
  '复制回复': 'Copy reply',
  '已复制': 'Copied',
  '高亮颜色': 'Highlight color',
  '高亮': 'Highlight',
  '加入笔记': 'Add to notes',
  '高亮并加入笔记': 'Highlight and add to notes',
  '任务': 'Task',
  '人员': 'Person',
  '复核': 'Review',
  '状态': 'Status',
  '决策': 'Decision',
  '原因': 'Reason',
  '未通过': 'Failed',
  '重试说明': 'Retry note',
  '通过': 'Pass',
  '不通过': 'Fail',
  '未填写人员描述': 'No person description',
  '人员异常。若目标站点未登录，请打开登录页后点击恢复人员。': 'Person error. If the target site is not signed in, open the login page and then click restore.',
  '查看提示词': 'View prompt',
  '关闭提示词详情': 'Close prompt details',
  '未填写提示词': 'No prompt provided',
  '先在设置中添加外部模型': 'Add an external model in settings first',
  'API 成员无需刷新窗口': 'API members do not need a window refresh',
  '刷新成员窗口': 'Refresh member window',
  '删除成员': 'Delete member',
  '未配置': 'Not configured',
  '暂无外部模型': 'No external models yet',
  '编辑': 'Edit',
  '测试': 'Test',
  '删除': 'Delete',
  '测试中': 'Testing',
  '测试通过': 'Test passed',
  '琥珀': 'Amber',
  '蓝色': 'Blue',
  '绿色': 'Green',
  '粉色': 'Pink',
  '紫色': 'Purple',
}

export const PROMPT_I18N = {
  'zh-CN': {
    responseLanguageInstruction: '请使用中文回复，除非用户明确要求其他语言。',
    personaLanguageInstruction: 'systemPrompt 使用中文，避免空泛口号，尽量可执行。',
    jsonOnly: '你必须只返回合法 JSON，不要 Markdown，不要解释文字，不要代码块。',
  },
  en: {
    responseLanguageInstruction: 'Respond in English unless the user explicitly asks for another language.',
    personaLanguageInstruction: 'Write name, description, and systemPrompt in English. Keep the systemPrompt concrete and actionable.',
    jsonOnly: 'Return valid JSON only. Do not include Markdown, explanations, or code fences.',
  },
} satisfies Record<TeamLanguage, Record<string, string>>

interface GroupTemplateLocalization {
  name: string
  summary?: string
  userTypes?: string[]
}

interface RoleTemplateLocalization {
  name: string
  description: string
  systemPrompt?: string
}

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  '全部': 'All',
  '思想风格顾问': 'Thought-style advisors',
  '学生与学习': 'Study and Learning',
  '职场效率': 'Work Productivity',
  '内容创作': 'Content Creation',
  '产品与创业': 'Product and Startups',
  '市场营销与销售': 'Marketing and Sales',
  '技术研发': 'Technology and R&D',
  '企业管理': 'Business Management',
  '财务、法律、合规': 'Finance, Legal, and Compliance',
  '电商与本地生意': 'E-commerce and Local Business',
  '专业服务': 'Professional Services',
  '行业垂直专家团': 'Industry Expert Teams',
}

const GROUP_TEMPLATE_LOCALIZATIONS: Record<string, GroupTemplateLocalization> = {
  'study-master': {
    name: 'Study Master Group',
    summary: 'Breaks real study work into goals, materials, schedules, practice, review, and feedback loops. Produces study plans, clear explanations, mistake reviews, memory-card plans, exam strategy, and next actions.',
    userTypes: ['Middle school students', 'College students', 'Self-learners'],
  },
  'exam-prep': { name: 'Exam Prep Group', summary: 'Turns long-cycle exam prep into scope maps, practice plans, mock questioning, weak-point reviews, feedback loops, and recovery plans.' },
  'thesis-writing': { name: 'Thesis Writing Group', summary: 'Supports topic narrowing, literature mapping, method design, structure, academic language, and research-risk review without replacing the student author.' },
  'study-abroad-application': { name: 'Study Abroad Application Group', summary: 'Helps applicants organize positioning, background evidence, narratives, resumes, interview prep, and visa materials while keeping final admissions judgment external.' },
  'daily-work-secretary': { name: 'Daily Work Secretary Group', summary: 'Converts schedules, emails, meetings, tasks, priorities, and daily reviews into executable work materials and follow-up plans.' },
  'project-delivery': { name: 'Project Delivery Group', summary: 'Breaks complex projects into goals, milestones, owners, progress tracking, risks, cross-team coordination, metrics, and retrospective outputs.' },
  'job-interview': { name: 'Job Interview Group' },
  'wechat-editorial': { name: 'WeChat Editorial Team' },
  'short-video-creation': { name: 'Short Video Creation Group' },
  'xiaohongshu-seeding': { name: 'Xiaohongshu Content Group' },
  'novel-writing': { name: 'Novel Writing Group' },
  'startup-advisory': { name: 'Startup Advisory Group' },
  'product-requirement-review': { name: 'Product Requirement Review Group' },
  'indie-developer-growth': { name: 'Indie Developer Growth Group' },
  'fundraising-bp-review': { name: 'Fundraising BP Review Group' },
  'growth-marketing': { name: 'Growth Marketing Group' },
  'sales-coaching': { name: 'Sales Coaching Group' },
  'brand-positioning': { name: 'Brand Positioning Group' },
  'software-development': { name: 'Software Development Group' },
  'ai-agent-development': { name: 'AI Agent Development Group' },
  'data-analysis': { name: 'Data Analysis Group' },
  'ceo-decision': { name: 'CEO Decision Group' },
  'manager-coaching': { name: 'Manager Coaching Group' },
  'hr-recruiting': { name: 'HR Recruiting Group' },
  'personal-finance': { name: 'Personal Finance Group' },
  'small-business-finance': { name: 'Small Business Finance Group' },
  'contract-review': { name: 'Contract Review Group' },
  'ecommerce-operations': { name: 'E-commerce Operations Group' },
  'local-store-growth': { name: 'Local Store Growth Group' },
  'restaurant-operations': { name: 'Restaurant Operations Group' },
  'consulting-advisory': { name: 'Consulting Advisory Group' },
  'teacher-lesson-planning': { name: 'Teacher Lesson Planning Group' },
  'mental-support-growth': { name: 'Mental Support and Growth Group' },
  'real-estate-analysis': { name: 'Real Estate Analysis Group' },
  'renovation-design': { name: 'Renovation Design Group' },
  'travel-planning': { name: 'Travel Planning Group' },
  'fitness-fat-loss': { name: 'Fitness and Fat Loss Group' },
  'medical-visit-prep': { name: 'Medical Visit Prep Group' },
  'agriculture-planting': { name: 'Agriculture Planting Group' },
  'manufacturing-improvement': { name: 'Manufacturing Improvement Group' },
  'supply-chain-procurement': { name: 'Supply Chain Procurement Group' },
  'construction-project': { name: 'Construction Project Group' },
  'law-firm-assistant': { name: 'Law Firm Assistant Group' },
  'medical-research': { name: 'Medical Research Group' },
  'financial-research': { name: 'Financial Research Group' },
}

const ROLE_NAME_TRANSLATIONS: Record<string, string> = Object.fromEntries([
  ['学习规划师', 'StudyPlanner'],
  ['知识讲解老师', 'ConceptTutor'],
  ['错题复盘师', 'MistakeReviewer'],
  ['记忆与复习教练', 'MemoryCoach'],
  ['考试策略师', 'ExamStrategist'],
  ['学习反馈教练', 'StudyFeedbackCoach'],
  ['大纲拆解员', 'SyllabusMapper'],
  ['真题研究员', 'PastPaperResearcher'],
  ['复习计划师', 'ReviewPlanner'],
  ['模拟考官', 'MockExaminer'],
  ['弱点诊断师', 'WeaknessDiagnostician'],
  ['心态恢复教练', 'MindsetRecoveryCoach'],
  ['选题评估顾问', 'TopicEvaluator'],
  ['文献脉络整理员', 'LiteratureMapper'],
  ['研究方法顾问', 'MethodsAdvisor'],
  ['论文结构编辑', 'ThesisStructureEditor'],
  ['学术语言润色师', 'AcademicLanguageEditor'],
  ['学术风险审查员', 'AcademicRiskReviewer'],
  ['选校定位顾问', 'SchoolPositioningAdvisor'],
  ['背景评估师', 'BackgroundEvaluator'],
  ['文书叙事导师', 'EssayNarrativeCoach'],
  ['申请简历顾问', 'ApplicationResumeAdvisor'],
  ['面试教练', 'InterviewCoach'],
  ['签证材料审核员', 'VisaMaterialsReviewer'],
  ['日程管家', 'ScheduleSteward'],
  ['邮件与消息助手', 'EmailMessageAssistant'],
  ['会议纪要员', 'MeetingNoteTaker'],
  ['任务拆解员', 'TaskDecomposer'],
  ['优先级排序顾问', 'PriorityAdvisor'],
  ['每日复盘员', 'DailyReviewFacilitator'],
  ['项目计划经理', 'ProjectPlanningManager'],
  ['进度追踪员', 'ProgressTracker'],
  ['项目风险审查员', 'ProjectRiskReviewer'],
  ['跨部门协调员', 'CrossTeamCoordinator'],
  ['项目指标分析师', 'ProjectMetricsAnalyst'],
  ['复盘主持人', 'RetrospectiveFacilitator'],
  ['职业方向规划师', 'CareerDirectionPlanner'],
  ['JD拆解师', 'JDAnalyzer'],
  ['简历证据优化师', 'ResumeEvidenceOptimizer'],
  ['面试官模拟器', 'InterviewerSimulator'],
  ['案例题教练', 'CaseInterviewCoach'],
  ['薪资谈判顾问', 'SalaryNegotiationAdvisor'],
  ['选题编辑', 'TopicEditor'],
  ['资料研究员', 'Researcher'],
  ['主笔', 'LeadWriter'],
  ['标题与开头顾问', 'HeadlineOpeningAdvisor'],
  ['事实核查员', 'FactChecker'],
  ['传播设计顾问', 'DistributionDesignAdvisor'],
  ['选题策划', 'TopicPlanner'],
  ['爆款拆解师', 'ViralContentAnalyst'],
  ['脚本作者', 'Scriptwriter'],
  ['分镜导演', 'StoryboardDirector'],
  ['标题封面顾问', 'TitleCoverAdvisor'],
  ['完播率优化师', 'CompletionRateOptimizer'],
  ['用户洞察师', 'UserInsightAnalyst'],
  ['笔记选题策划', 'PostTopicPlanner'],
  ['种草文案师', 'SeedingCopywriter'],
  ['评论区运营', 'CommentOpsManager'],
  ['内容合规审查员', 'ContentComplianceReviewer'],
  ['世界观设计师', 'WorldbuildingDesigner'],
  ['角色设计师', 'CharacterDesigner'],
  ['情节架构师', 'PlotArchitect'],
  ['场景描写师', 'SceneWriter'],
  ['对白编辑', 'DialogueEditor'],
  ['读者体验审查员', 'ReaderExperienceReviewer'],
  ['商业模式顾问', 'BusinessModelAdvisor'],
  ['用户研究员', 'UserResearcher'],
  ['MVP产品经理', 'MVPProductManager'],
  ['增长实验顾问', 'GrowthExperimentAdvisor'],
  ['创业财务顾问', 'StartupFinanceAdvisor'],
  ['创业风险审查员', 'StartupRiskReviewer'],
  ['需求产品经理', 'RequirementsProductManager'],
  ['工程评估师', 'EngineeringEvaluator'],
  ['产品设计师', 'ProductDesigner'],
  ['指标与实验分析师', 'MetricsExperimentAnalyst'],
  ['增长价值评审员', 'GrowthValueReviewer'],
  ['产品定位顾问', 'ProductPositioningAdvisor'],
  ['轻量技术架构师', 'LeanTechArchitect'],
  ['定价与包装顾问', 'PricingPackagingAdvisor'],
  ['冷启动顾问', 'ColdStartAdvisor'],
  ['落地执行教练', 'ExecutionCoach'],
  ['用户反馈分析师', 'UserFeedbackAnalyst'],
  ['投资人模拟器', 'InvestorSimulator'],
  ['BP结构顾问', 'BPStructureAdvisor'],
  ['市场规模分析师', 'MarketSizingAnalyst'],
  ['财务模型师', 'FinancialModeler'],
  ['竞争分析师', 'CompetitiveAnalyst'],
  ['风险质询官', 'RiskQuestioner'],
  ['用户画像分析师', 'PersonaAnalyst'],
  ['渠道策略师', 'ChannelStrategist'],
  ['转化率优化师', 'ConversionRateOptimizer'],
  ['A/B测试设计师', 'ABTestDesigner'],
  ['增长数据分析师', 'GrowthDataAnalyst'],
  ['留存运营顾问', 'RetentionOpsAdvisor'],
  ['客户分层画像师', 'CustomerSegmentationAnalyst'],
  ['需求挖掘话术教练', 'DiscoveryScriptCoach'],
  ['客户异议模拟器', 'ObjectionSimulator'],
  ['跟进节奏策略师', 'FollowUpCadenceStrategist'],
  ['成交流程推进顾问', 'DealFlowAdvisor'],
  ['CRM复盘记录员', 'CRMReviewRecorder'],
  ['品牌定位架构师', 'BrandPositioningArchitect'],
  ['用户心智研究员', 'CustomerMindsetResearcher'],
  ['品牌表达文案总监', 'BrandCopyDirector'],
  ['视觉方向顾问', 'VisualDirectionAdvisor'],
  ['竞品差异分析师', 'CompetitorDifferentiationAnalyst'],
  ['公关风险审查员', 'PRRiskReviewer'],
  ['需求澄清架构师', 'RequirementClarificationArchitect'],
  ['后端实现工程师', 'BackendImplementationEngineer'],
  ['前端交互工程师', 'FrontendInteractionEngineer'],
  ['质量测试工程师', 'QAEngineer'],
  ['DevOps发布工程师', 'DevOpsReleaseEngineer'],
  ['防御安全审查员', 'DefensiveSecurityReviewer'],
  ['Agent任务产品经理', 'AgentTaskProductManager'],
  ['Prompt规范工程师', 'PromptSpecEngineer'],
  ['工作流编排架构师', 'WorkflowOrchestrationArchitect'],
  ['工具调用与权限工程师', 'ToolPermissionEngineer'],
  ['Agent评测工程师', 'AgentEvaluationEngineer'],
  ['安全与治理审查员', 'SafetyGovernanceReviewer'],
  ['指标口径分析师', 'MetricDefinitionAnalyst'],
  ['指标体系顾问', 'MetricsSystemAdvisor'],
  ['SQL查询构造员', 'SQLQueryBuilder'],
  ['可视化看板设计师', 'DashboardDesigner'],
  ['业务假设解释员', 'BusinessHypothesisInterpreter'],
  ['数据决策实验设计师', 'DataDecisionExperimentDesigner'],
  ['战略取舍顾问', 'StrategicTradeoffAdvisor'],
  ['经营财务顾问', 'BusinessFinanceAdvisor'],
  ['组织能力顾问', 'OrgCapabilityAdvisor'],
  ['市场机会顾问', 'MarketOpportunityAdvisor'],
  ['合规与法务风险顾问', 'ComplianceLegalRiskAdvisor'],
  ['反方论证顾问', 'DevilAdvocate'],
  ['管理目标教练', 'ManagementGoalCoach'],
  ['绩效标准顾问', 'PerformanceStandardsAdvisor'],
  ['困难沟通教练', 'DifficultConversationCoach'],
  ['冲突调解员', 'ConflictMediator'],
  ['会议机制设计师', 'MeetingSystemDesigner'],
  ['员工视角模拟器', 'EmployeePerspectiveSimulator'],
  ['岗位能力设计师', 'RoleCapabilityDesigner'],
  ['简历证据筛选员', 'ResumeEvidenceScreener'],
  ['结构化面试官', 'StructuredInterviewer'],
  ['薪酬区间顾问', 'CompensationRangeAdvisor'],
  ['文化与协作评估员', 'CultureCollaborationEvaluator'],
  ['入职体验设计师', 'OnboardingExperienceDesigner'],
  ['预算规划师', 'BudgetPlanner'],
  ['储蓄与应急金教练', 'SavingsEmergencyFundCoach'],
  ['债务管理顾问', 'DebtManagementAdvisor'],
  ['投资知识老师', 'InvestmentLiteracyTutor'],
  ['财务风险提醒员', 'FinancialRiskReminder'],
  ['保障与生活方式顾问', 'ProtectionLifestyleAdvisor'],
  ['记账顾问', 'BookkeepingAdvisor'],
  ['成本分析师', 'CostAnalyst'],
  ['定价顾问', 'PricingAdvisor'],
  ['现金流顾问', 'CashflowAdvisor'],
  ['税务提醒员', 'TaxReminder'],
  ['经营建议员', 'BusinessOperationsAdvisor'],
  ['合同结构分析师', 'ContractStructureAnalyst'],
  ['合同风险审查员', 'ContractRiskReviewer'],
  ['商务谈判顾问', 'CommercialNegotiationAdvisor'],
  ['权责对照员', 'RightsObligationsMapper'],
  ['付款条款审查员', 'PaymentTermsReviewer'],
  ['法域与律师确认清单员', 'LegalJurisdictionChecklistReviewer'],
  ['选品顾问', 'ProductSelectionAdvisor'],
  ['竞品分析师', 'CompetitorAnalyst'],
  ['详情页文案师', 'ProductPageCopywriter'],
  ['广告投放顾问', 'AdCampaignAdvisor'],
  ['客服话术师', 'CustomerServiceScriptwriter'],
  ['复购运营顾问', 'RepeatPurchaseOpsAdvisor'],
  ['门店定位顾问', 'StorePositioningAdvisor'],
  ['活动策划师', 'CampaignPlanner'],
  ['点评优化师', 'ReviewOptimizationAdvisor'],
  ['私域运营顾问', 'PrivateTrafficOpsAdvisor'],
  ['短视频顾问', 'ShortVideoAdvisor'],
  ['复购顾问', 'RepeatPurchaseAdvisor'],
  ['菜单顾问', 'MenuAdvisor'],
  ['成本控制师', 'CostController'],
  ['外卖运营顾问', 'DeliveryOpsAdvisor'],
  ['用户评价分析师', 'CustomerReviewAnalyst'],
  ['店长顾问', 'StoreManagerAdvisor'],
  ['问题诊断师', 'ProblemDiagnostician'],
  ['行业研究员', 'IndustryResearcher'],
  ['框架顾问', 'FrameworkAdvisor'],
  ['方案设计师', 'SolutionDesigner'],
  ['PPT结构师', 'DeckStructureDesigner'],
  ['客户质询模拟器', 'ClientQuestionSimulator'],
  ['课程设计师', 'CurriculumDesigner'],
  ['教案编写员', 'LessonPlanWriter'],
  ['练习题设计师', 'ExerciseDesigner'],
  ['学生理解模拟器', 'StudentUnderstandingSimulator'],
  ['课堂互动设计师', 'ClassroomInteractionDesigner'],
  ['作业批改助手', 'HomeworkReviewAssistant'],
  ['情绪倾听者', 'EmotionListener'],
  ['CBT自助练习引导员', 'CBTSelfHelpGuide'],
  ['习惯教练', 'HabitCoach'],
  ['关系沟通顾问', 'RelationshipCommunicationAdvisor'],
  ['价值澄清教练', 'ValuesClarificationCoach'],
  ['安全与求助资源提醒员', 'SafetyResourceReminder'],
  ['市场分析师', 'MarketAnalyst'],
  ['区域研究员', 'RegionalResearcher'],
  ['贷款顾问', 'LoanAdvisor'],
  ['合同风险员', 'ContractRiskChecker'],
  ['谈判顾问', 'NegotiationAdvisor'],
  ['装修预算顾问', 'RenovationBudgetAdvisor'],
  ['空间设计师', 'SpaceDesigner'],
  ['预算控制师', 'BudgetController'],
  ['材料顾问', 'MaterialsAdvisor'],
  ['施工监理', 'ConstructionSupervisor'],
  ['收纳顾问', 'StorageAdvisor'],
  ['风格顾问', 'StyleAdvisor'],
  ['行程规划师', 'ItineraryPlanner'],
  ['酒店顾问', 'HotelAdvisor'],
  ['美食顾问', 'FoodAdvisor'],
  ['交通顾问', 'TransportAdvisor'],
  ['预算顾问', 'BudgetAdvisor'],
  ['风险提醒员', 'RiskReminder'],
  ['训练教练', 'TrainingCoach'],
  ['饮食规划师', 'NutritionPlanner'],
  ['动作纠正员', 'MovementCorrectionCoach'],
  ['数据记录员', 'DataRecorder'],
  ['健康风险提醒员', 'HealthRiskReminder'],
  ['症状整理员', 'SymptomOrganizer'],
  ['病史记录员', 'MedicalHistoryRecorder'],
  ['检查单解释员', 'TestReportExplainer'],
  ['就诊问题设计师', 'DoctorVisitQuestionDesigner'],
  ['用药信息提醒员', 'MedicationInfoReminder'],
  ['专业就医提醒员', 'ProfessionalCareReminder'],
  ['作物顾问', 'CropAdvisor'],
  ['病虫害分析师', 'PestDiseaseAnalyst'],
  ['土壤顾问', 'SoilAdvisor'],
  ['农资采购顾问', 'FarmInputProcurementAdvisor'],
  ['销售渠道顾问', 'SalesChannelAdvisor'],
  ['天气风险提醒员', 'WeatherRiskReminder'],
  ['生产流程顾问', 'ProductionProcessAdvisor'],
  ['质量管理顾问', 'QualityManagementAdvisor'],
  ['设备维护顾问', 'EquipmentMaintenanceAdvisor'],
  ['生产安全员', 'ProductionSafetyOfficer'],
  ['交付计划员', 'DeliveryPlanner'],
  ['供应商筛选员', 'SupplierScreener'],
  ['报价分析师', 'QuotationAnalyst'],
  ['库存规划师', 'InventoryPlanner'],
  ['物流顾问', 'LogisticsAdvisor'],
  ['供应链质量审查员', 'SupplyChainQualityReviewer'],
  ['项目计划员', 'ProjectPlanner'],
  ['预算员', 'Estimator'],
  ['施工协调员', 'ConstructionCoordinator'],
  ['工程安全提醒员', 'EngineeringSafetyReminder'],
  ['材料采购与质量资料员', 'MaterialsProcurementQualityClerk'],
  ['工程风险审查员', 'EngineeringRiskReviewer'],
  ['案件事实整理员', 'CaseFactOrganizer'],
  ['法规检索员', 'LegalResearcher'],
  ['证据清单员', 'EvidenceChecklistClerk'],
  ['文书草拟员', 'LegalDraftingAssistant'],
  ['对方观点模拟器', 'OpposingViewSimulator'],
  ['程序期限与风险提示员', 'ProcedureDeadlineRiskReminder'],
  ['文献检索员', 'LiteratureSearcher'],
  ['临床问题拆解员', 'ClinicalQuestionDecomposer'],
  ['研究设计顾问', 'ResearchDesignAdvisor'],
  ['统计分析师', 'StatisticalAnalyst'],
  ['论文编辑', 'PaperEditor'],
  ['伦理合规提醒员', 'EthicsComplianceReminder'],
  ['宏观分析师', 'MacroAnalyst'],
  ['公司与估值情景分析师', 'CompanyValuationScenarioAnalyst'],
  ['财务报表分析师', 'FinancialStatementAnalyst'],
  ['金融风险控制员', 'FinancialRiskController'],
  ['反方观点分析师', 'ContrarianAnalyst'],
] satisfies Array<readonly [string, string]>)

const ROLE_DESCRIPTION_TRANSLATIONS: Record<string, string> = {
  '学习规划师': 'Turns courses, exams, and self-study goals into realistic daily plans, weekly plans, checkpoints, and review loops.',
  '知识讲解老师': 'Explains a requested concept clearly and checks understanding with examples, counterexamples, mistakes, and short exercises.',
  '错题复盘师': 'Finds knowledge gaps, reading errors, process mistakes, and habit issues from problems, answers, and working steps.',
  '记忆与复习教练': 'Turns memorization and long-term retention work into active-recall, spaced-review, and testing systems.',
  '考试策略师': 'Builds practical exam strategies from scope, scoring rules, time limits, and weak points.',
  '学习反馈教练': 'Reviews learning progress and turns feedback into focused next actions.',
  '大纲拆解员': 'Breaks an exam syllabus into topics, priorities, and review checkpoints.',
  '真题研究员': 'Studies past papers to find patterns, high-frequency topics, and practice priorities.',
  '复习计划师': 'Creates review plans that balance scope, time, weak points, and repetition.',
  '模拟考官': 'Simulates exam questioning and gives structured feedback.',
  '弱点诊断师': 'Diagnoses weak areas and turns them into targeted practice plans.',
  '心态恢复教练': 'Helps recover confidence and focus during stressful preparation cycles.',
}

const ROLE_TEMPLATE_LOCALIZATIONS: Record<string, RoleTemplateLocalization> = {
  'builtin-frankl': { name: 'ViktorFrankl', description: 'Meaning therapy, responsibility, dignity in suffering, and direction for action.' },
  'builtin-camus': { name: 'AlbertCamus', description: 'Absurdity, revolt, freedom, dignity, and clear-eyed living.' },
  'builtin-nietzsche': { name: 'FriedrichNietzsche', description: 'Self-overcoming, revaluing values, amor fati, and life force.' },
  'builtin-wang-yangming': { name: 'WangYangming', description: 'Unity of knowing and doing, conscience, practice in real affairs, and self-cultivation.' },
  'builtin-steve-jobs': { name: 'SteveJobs', description: 'Product taste, focus, tradeoffs, aesthetics, and end-to-end experience.' },
  'builtin-inamori': { name: 'KazuoInamori', description: 'Management, self-cultivation, altruism, diligence, and long-term integrity.' },
  'builtin-drucker': { name: 'PeterDrucker', description: 'Self-management, contribution, time management, and results-oriented work.' },
  'builtin-munger': { name: 'CharlieMunger', description: 'Mental models, inversion, circle of competence, and avoiding major mistakes.' },
  'builtin-buffett': { name: 'WarrenBuffett', description: 'Long-term wealth, compounding, circle of competence, reputation, and prudent money habits.' },
  'builtin-howard-marks': { name: 'HowardMarks', description: 'Risk, cycles, probability, second-order thinking, and market psychology.' },
  'builtin-graham': { name: 'BenjaminGraham', description: 'Value investing, margin of safety, defensive investing, and Mr. Market.' },
  'builtin-peter-lynch': { name: 'PeterLynch', description: 'Everyday investment observation, fundamental research, and common-sense judgment.' },
  'builtin-dalio': { name: 'RayDalio', description: 'Principles, reflection, radical truth, systematic decision-making, and risk diversification.' },
  'builtin-naval': { name: 'NavalRavikant', description: 'Wealth, freedom, specific knowledge, leverage, ownership, and happiness.' },
  'builtin-zhang-yiming': { name: 'ZhangYiming', description: 'Long-term growth, delayed gratification, real feedback, and equanimity.' },
  'builtin-ren-zhengfei': { name: 'RenZhengfei', description: 'Organizational capability, customer value, crisis awareness, and growth from real battles.' },
  'builtin-feynman': { name: 'RichardFeynman', description: 'Learning, understanding, curiosity, simple explanation, and anti-jargon thinking.' },
  'builtin-kahneman': { name: 'DanielKahneman', description: 'Judgment bias, slow thinking, evidence, and decision process design.' },
  'builtin-taleb': { name: 'NassimTaleb', description: 'Antifragility, black swans, nonlinear risk, and barbell strategy.' },
  'builtin-bezos': { name: 'JeffBezos', description: 'Customer obsession, long-term thinking, flywheels, and working backwards.' },
  'builtin-musk': { name: 'ElonMusk', description: 'First principles, engineering decomposition, speed, and real constraints.' },
  'builtin-paul-graham': { name: 'PaulGraham', description: 'Early startups, MVPs, user pain, and doing things that do not scale.' },
  'builtin-thiel': { name: 'PeterThiel', description: 'Zero to one thinking, secrets, moats, and avoiding commodity competition.' },
  'builtin-huang-zheng': { name: 'HuangZheng', description: 'Supply-demand structure, group psychology, efficiency, price, and trust.' },
  'builtin-sam-altman': { name: 'SamAltman', description: 'AI-era opportunity, startups, fast learning, major trends, and leverage.' },
  'builtin-adler': { name: 'AlfredAdler', description: 'Inferiority and striving, separation of tasks, community feeling, and courage.' },
  'builtin-jung': { name: 'CarlJung', description: 'Shadow, persona, individuation, self-integration, and projection.' },
  'builtin-schopenhauer': { name: 'ArthurSchopenhauer', description: 'Desire, suffering, comparison, solitude, aesthetics, and restraint.' },
  'builtin-fei-xiaotong': { name: 'FeiXiaotong', description: 'Rural China, differential association, family ethics, and social pressure.' },
  'builtin-liang-shuming': { name: 'LiangShuming', description: 'Chinese culture, ethical relationships, life settlement, and modern tensions.' },
  'builtin-waldinger': { name: 'RobertWaldinger', description: 'Harvard adult development research, relationship quality, happiness, and long-term connection.' },
  'builtin-school-of-life': { name: 'SchoolOfLife', description: 'Emotional education, relationship repair, self-understanding, and practical philosophy.' },
  'builtin-kevin-kelly': { name: 'KevinKelly', description: 'Technology trends, complex systems, AI, creator economy, and experimentation.' },
  'builtin-toffler': { name: 'AlvinToffler', description: 'Future shock, the third wave, technology speed, and adaptation.' },
  'builtin-einstein': { name: 'AlbertEinstein', description: 'Curiosity, imagination, independent thinking, simple questions, and scientific spirit.' },
  'builtin-80000-hours': { name: 'EightyThousandHours', description: 'High-impact careers, fit, career capital, and exploration value.' },
  'builtin-who-health': { name: 'WHOHealth', description: 'Sleep, movement, nutrition, stress, and sustainable health habits.' },
  'builtin-wef-future': { name: 'WEFFuture', description: 'Global trends, future work, AI, macro risks, and skill building.' },
  'default-custom-product-manager': { name: 'ProductManager', description: 'Focuses on user needs, priorities, tradeoffs, and product experience.' },
  'default-custom-engineer': { name: 'Engineer', description: 'Focuses on implementation, complexity, stability, and maintainability.' },
  'default-custom-growth': { name: 'GrowthAdvisor', description: 'Focuses on target users, conversion paths, distribution, retention, and experiments.' },
}

const USER_TYPE_TRANSLATIONS: Record<string, string> = {
  '中学生': 'Middle school students',
  '大学生': 'College students',
  '自学者': 'Self-learners',
  '考研': 'Graduate exam candidates',
  '考公': 'Civil-service exam candidates',
  '本科生': 'Undergraduates',
  '研究生': 'Graduate students',
  '博士生': 'Doctoral students',
  '科研新人': 'New researchers',
  '知识工作者': 'Knowledge workers',
  '白领': 'Office workers',
  '远程工作者': 'Remote workers',
  '自由职业者': 'Freelancers',
  '项目经理': 'Project managers',
  '团队负责人': 'Team leads',
  '运营负责人': 'Operations leads',
  '求职者': 'Job seekers',
  '转行者': 'Career changers',
  '应届生': 'New graduates',
  '创业者': 'Founders',
  '独立开发者': 'Indie developers',
  '小团队老板': 'Small-team owners',
  '产品经理': 'Product managers',
  '程序员': 'Programmers',
  '技术负责人': 'Technical leads',
  '销售': 'Salespeople',
  '市场团队': 'Marketing teams',
  '老师': 'Teachers',
  '咨询师': 'Consultants',
  '顾问': 'Advisors',
  '医生': 'Doctors',
  '律师': 'Lawyers',
  '法务': 'Legal staff',
  '普通个人': 'Individuals',
  '家庭用户': 'Households',
  '小老板': 'Small business owners',
  '个体户': 'Solo business owners',
}

export function normalizeLanguage(value: unknown): TeamLanguage {
  return value === 'zh-CN' ? 'zh-CN' : DEFAULT_LANGUAGE
}

export function defaultLanguageForEnvironment(navigatorLike: Pick<Navigator, 'language' | 'languages'> | undefined = globalThis.navigator): TeamLanguage {
  const languages = [
    ...(Array.isArray(navigatorLike?.languages) ? navigatorLike.languages : []),
    navigatorLike?.language,
  ].filter((language): language is string => typeof language === 'string')
  return languages.some(language => /^zh(?:-|$)/i.test(language)) ? 'zh-CN' : DEFAULT_LANGUAGE
}

export function translateUi(source: string, language: TeamLanguage): string {
  if (language === 'zh-CN') return source
  return UI_TRANSLATIONS[source] ?? translateUiPattern(source) ?? source
}

export function localizeCategory(category: string | undefined, language: TeamLanguage): string | undefined {
  if (!category) return undefined
  if (normalizeLanguage(language) === 'zh-CN') return category
  return CATEGORY_TRANSLATIONS[category] ?? category
}

export function localizeGroupTemplate(template: BuiltinGroupTemplate, language: TeamLanguage): BuiltinGroupTemplate {
  if (normalizeLanguage(language) === 'zh-CN') return template
  const localization = GROUP_TEMPLATE_LOCALIZATIONS[template.id]
  const name = localization?.name ?? fallbackGroupTemplateName(template)
  return {
    ...template,
    name,
    category: localizeCategory(template.category, 'en') ?? template.category,
    summary: localization?.summary ?? fallbackGroupSummary(name),
    userTypes: localizeUserTypes(template.userTypes, localization),
    aliases: englishTemplateAliases(template, name),
    suggestedQuestions: englishTemplateQuestions(name),
    defaultChatName: name,
    roles: template.roles.map(role => localizeGroupTemplateRole(template, role, name)),
  }
}

export function localizeRoleTemplate(template: RoleTemplate, language: TeamLanguage): RoleTemplate {
  if (normalizeLanguage(language) === 'zh-CN') return template
  const direct = ROLE_TEMPLATE_LOCALIZATIONS[template.id]
  if (direct) {
    return {
      ...template,
      name: direct.name,
      category: localizeCategory(template.category, 'en'),
      description: direct.description,
      sourceTemplateName: localizeSourceTemplateName(template.sourceTemplateId, template.sourceTemplateName),
      systemPrompt: direct.systemPrompt ?? englishAdvisorPrompt(direct.name, direct.description),
    }
  }

  if (template.sourceTemplateId) {
    const sourceTemplateName = localizeSourceTemplateName(template.sourceTemplateId, template.sourceTemplateName)
    const roleName = localizeRoleName(template.name, sourceTemplateName, template.sourceTemplateId)
    const description = localizeRoleDescription(template.name, sourceTemplateName)
    return {
      ...template,
      name: roleName,
      category: localizeCategory(template.category, 'en'),
      description,
      sourceTemplateName,
      systemPrompt: englishRolePrompt(roleName, description),
    }
  }

  if (template.type === 'builtin') {
    const roleName = fallbackRoleName(template.name, 'BuiltInAdvisor')
    const description = 'Built-in advisor persona.'
    return {
      ...template,
      name: roleName,
      category: localizeCategory(template.category, 'en'),
      description,
      systemPrompt: englishRolePrompt(roleName, description),
    }
  }

  return template
}

function translateUiPattern(source: string): string | undefined {
  const storeSummary = source.match(/^(\d+) 个群聊 · (\d+) 个人员库人员$/)
  if (storeSummary) return `${storeSummary[1]} chats · ${storeSummary[2]} people`
  const agentControlPort = source.match(/^端口 (\d+)，仅允许本机连接。(?:开启后本机工具可创建群聊并发送任务。)?$/)
  if (agentControlPort) {
    return `Port ${agentControlPort[1]}; local connections only.${source.includes('开启后') ? ' When enabled, local tools can create chats and send tasks.' : ''}`
  }
  const agentControlConnected = source.match(/^已连接 OpenTeam CLI daemon（端口 (\d+)）。本机工具可以创建群聊并发送任务。$/)
  if (agentControlConnected) return `Connected to OpenTeam CLI daemon (port ${agentControlConnected[1]}). Local tools can create chats and send tasks.`
  const agentControlConnecting = source.match(/^正在连接 OpenTeam CLI daemon（端口 (\d+)）。$/)
  if (agentControlConnecting) return `Connecting to OpenTeam CLI daemon (port ${agentControlConnecting[1]}).`
  const agentControlDisconnected = source.match(/^未连接 OpenTeam CLI daemon（端口 (\d+)）。请安装 OpenTeam CLI，或运行 openteamcli daemon start 启动守护进程。$/)
  if (agentControlDisconnected) return `Not connected to OpenTeam CLI daemon (port ${agentControlDisconnected[1]}). Install OpenTeam CLI, or run openteamcli daemon start to start the daemon.`
  const currentPerson = source.match(/^(\d+) 人员 · 当前：(.+)$/)
  if (currentPerson) return `${currentPerson[1]} people · Current: ${currentPerson[2]}`
  const memberCount = source.match(/^成员 (\d+)$/)
  if (memberCount) return `Members ${memberCount[1]}`
  const roleSummaryCount = source.match(/^(\d+) 人员$/)
  if (roleSummaryCount) return `${roleSummaryCount[1]} people`
  const peopleCount = source.match(/^(\d+) 个人员$/)
  if (peopleCount) return `${peopleCount[1]} people`
  const peopleSummary = source.match(/^(\d+) 人$/)
  if (peopleSummary) return `${peopleSummary[1]} people`
  const roleCount = source.match(/^(\d+) 个角色$/)
  if (roleCount) return `${roleCount[1]} roles`
  const readCount = source.match(/^已读 (\d+) 条$/)
  if (readCount) return `Read ${readCount[1]} messages`
  const defaultModel = source.match(/^默认模型：(.+)$/)
  if (defaultModel) return `Default model: ${translateUi(defaultModel[1], 'en')}`
  const appliesTo = source.match(/^适用：(.+)$/)
  if (appliesTo) return `For: ${appliesTo[1]}`
  const editPerson = source.match(/^编辑人员：(.+)$/)
  if (editPerson) return `Edit person: ${editPerson[1]}`
  const deletedChat = source.match(/^已删除群聊 (.+)$/)
  if (deletedChat) return `Deleted chat ${deletedChat[1]}`
  const missingPeople = source.match(/^没有匹配的(内置|自定义)人员$/)
  if (missingPeople) return `No matching ${missingPeople[1] === '内置' ? 'built-in' : 'custom'} people`
  const emptyPeople = source.match(/^暂无(内置|自定义)人员$/)
  if (emptyPeople) return `No ${emptyPeople[1] === '内置' ? 'built-in' : 'custom'} people yet`
  const emptyCategory = source.match(/^当前分类暂无(内置|自定义)人员$/)
  if (emptyCategory) return `No ${emptyCategory[1] === '内置' ? 'built-in' : 'custom'} people in this category`
  const colonLabel = source.match(/^(.+)：$/)
  if (colonLabel && UI_TRANSLATIONS[colonLabel[1]]) return `${UI_TRANSLATIONS[colonLabel[1]]}:`
  const quote = source.match(/^引用 (.+)：(.+)$/)
  if (quote) return `Quote ${quote[1]}: ${quote[2]}`
  const highlightColor = source.match(/^高亮颜色：(.+)$/)
  if (highlightColor) return `Highlight color: ${translateUi(highlightColor[1], 'en')}`
  const orchestrationStep = source.match(/^第 (\d+) 步$/)
  if (orchestrationStep) return `Step ${orchestrationStep[1]}`
  const headerSummary = source.match(/^(协作群聊模式|独立专家模式) · (\d+) 位成员 · (\d+) 条消息$/)
  if (headerSummary) return `${translateUi(headerSummary[1], 'en')} · ${headerSummary[2]} members · ${headerSummary[3]} messages`
  if (source.includes(' · ')) return source.split(' · ').map(part => translateUi(part, 'en')).join(' · ')
  const sendWithConnecting = source.match(/^将发送给：(.+)；正在连接：(.+)$/)
  if (sendWithConnecting) return `Will send to: ${sendWithConnecting[1]}; connecting: ${sendWithConnecting[2]}`
  const sendWithWaiting = source.match(/^将发送给：(.+)；跳过正在回复：(.+)$/)
  if (sendWithWaiting) return `Will send to: ${sendWithWaiting[1]}; skipping people already replying: ${sendWithWaiting[2]}`
  return undefined
}

function localizeGroupTemplateRole(template: BuiltinGroupTemplate, role: BuiltinGroupTemplateRole, groupName: string): BuiltinGroupTemplateRole {
  const name = localizeRoleName(role.name, groupName, template.id)
  const description = ROLE_DESCRIPTION_TRANSLATIONS[baseRoleName(role.name)] ?? fallbackRoleDescription(name, groupName)
  return {
    name,
    description,
    systemPrompt: englishRolePrompt(name, description),
  }
}

function localizeRoleName(rawName: string, groupName: string | undefined, sourceTemplateId?: string): string {
  const baseName = baseRoleName(rawName)
  return ROLE_NAME_TRANSLATIONS[baseName] ?? fallbackRoleName(groupName ?? sourceTemplateId ?? rawName, 'Specialist')
}

function localizeRoleDescription(rawName: string, groupName: string | undefined): string {
  return ROLE_DESCRIPTION_TRANSLATIONS[baseRoleName(rawName)] ?? fallbackRoleDescription(localizeRoleName(rawName, groupName), groupName ?? 'this workflow')
}

function localizeSourceTemplateName(sourceTemplateId: string | undefined, sourceTemplateName: string | undefined): string | undefined {
  if (!sourceTemplateId && !sourceTemplateName) return undefined
  return sourceTemplateId ? GROUP_TEMPLATE_LOCALIZATIONS[sourceTemplateId]?.name ?? sourceTemplateName : sourceTemplateName
}

function baseRoleName(name: string): string {
  const parts = name.split('·')
  return parts[parts.length - 1]?.trim() || name
}

function englishRolePrompt(name: string, description: string): string {
  return [
    `You are ${name}.`,
    description,
    'Ask for missing context before making firm recommendations. Give concrete outputs, state assumptions, and call out risks or limits. Respond in English unless the user explicitly asks for another language.',
  ].join('\n\n')
}

function englishAdvisorPrompt(name: string, description: string): string {
  return [
    `You are ${name}, an advisory persona inspired by public ideas around: ${description}`,
    'You are not the original person and should not fabricate quotes. Help the user reason clearly, separate facts from judgments, and turn insight into practical next actions. Respond in English unless the user explicitly asks for another language.',
  ].join('\n\n')
}

function fallbackGroupTemplateName(template: Pick<BuiltinGroupTemplate, 'id' | 'name'>): string {
  return `${titleCaseIdentifier(template.id || template.name)} Group`
}

function fallbackGroupSummary(groupName: string): string {
  return `Ready-made AI team for ${stripGroupSuffix(groupName).toLowerCase()} work. It helps clarify goals, organize inputs, draft useful outputs, review risks, and define next actions.`
}

function fallbackRoleDescription(name: string, groupName: string): string {
  return `${name} supports ${stripGroupSuffix(groupName).toLowerCase()} work with concrete analysis, useful drafts, risk checks, and next actions.`
}

function localizeUserTypes(userTypes: string[], localization: GroupTemplateLocalization | undefined): string[] {
  if (localization?.userTypes) return localization.userTypes
  return userTypes.map(userType => USER_TYPE_TRANSLATIONS[userType] ?? fallbackUserType(userType))
}

function fallbackUserType(userType: string): string {
  if (/^[\w\s./+-]+$/.test(userType)) return userType
  return 'Relevant users'
}

function englishTemplateAliases(template: BuiltinGroupTemplate, groupName: string): string[] {
  return [
    stripGroupSuffix(groupName),
    template.id,
    localizeCategory(template.category, 'en') ?? '',
    ...template.roles.map(role => localizeRoleName(role.name, groupName, template.id)),
  ].filter(Boolean)
}

function englishTemplateQuestions(groupName: string): string[] {
  return [
    'What problem do I want to solve?',
    'What materials or background do I already have?',
    'What final output do I need?',
    `Help me clarify the goal, context, and missing information for this ${stripGroupSuffix(groupName).toLowerCase()} task.`,
    'Create an information checklist from my materials.',
    'Ask the right roles to review this and summarize consensus, risks, and next actions.',
  ]
}

function fallbackRoleName(value: string, suffix: string): string {
  const readable = titleCaseIdentifier(value)
  const collapsed = readable.replace(/\s+/g, '')
  return collapsed.endsWith(suffix) ? collapsed : `${collapsed}${suffix}`
}

function titleCaseIdentifier(value: string): string {
  const withoutHan = value.replace(/[\u3400-\u9fff]+/g, ' ')
  const words = withoutHan
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return 'OpenTeam'
  return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function stripGroupSuffix(value: string): string {
  return value.replace(/\s+Group$/, '')
}
