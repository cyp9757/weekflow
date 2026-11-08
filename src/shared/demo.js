import {
  addDaysISO,
  addWeeksISO,
  completeTask,
  createDefaultState,
  createProject,
  createTask,
  drawPool,
  redeemReward,
  repairLedger,
  startOfWeekISO,
  todayISO,
} from './domain.js';

export function createDemoState(now = new Date()) {
  const state = createDefaultState(now);
  const currentWeek = startOfWeekISO(todayISO(now));
  const cppStart = addWeeksISO(currentWeek, -5);
  const photoStart = addWeeksISO(currentWeek, -2);

  const cpp = createProject(
    state,
    {
      title: 'C++ 从语法到小引擎',
      goal: '十二周内能独立写一个带渲染循环的小型 2D 引擎，并用它完成一个可玩的 demo。',
      startDate: cppStart,
      weeks: 12,
      source: 'demo',
    },
    now,
  );
  cpp.color = '#9AA9D6';
  cpp.weeksMeta = [
    { week: 1, theme: '环境与语法地基', outcome: '编译运行第一个多文件程序' },
    { week: 2, theme: '指针与内存', outcome: '手写一个动态数组' },
    { week: 3, theme: '面向对象', outcome: '用类重构动态数组' },
    { week: 4, theme: 'STL 与调试', outcome: '完成一个命令行小工具' },
    { week: 5, theme: '工程化与 CMake', outcome: '项目可以一条命令构建' },
    { week: 6, theme: '窗口与事件循环', outcome: '窗口能响应键盘输入' },
    { week: 7, theme: '渲染管线初探', outcome: '画出第一张纹理' },
    { week: 8, theme: '精灵与动画', outcome: '角色可以播放动画' },
    { week: 9, theme: '碰撞与关卡', outcome: '完成一个可玩房间' },
    { week: 10, theme: '资源与音频', outcome: '加入音效与资源管理' },
    { week: 11, theme: '打磨与性能', outcome: '稳定 60 帧，修掉明显卡顿' },
    { week: 12, theme: '发布与复盘', outcome: '打包 demo 并写开发复盘' },
  ];

  const cppWeekPlans = [
    [['装好编译器并跑通 Hello World', 10, 45], ['读完指针与引用的章节', 15, 90], ['写 10 个小练习', 15, 60]],
    [['手写动态数组：push / resize', 25, 120], ['用 Valgrind 或 ASan 查一次泄漏', 15, 60]],
    [['把动态数组改成类模板', 25, 120], ['整理拷贝/移动构造笔记', 15, 60]],
    [['用 STL 容器重写词频统计', 20, 90], ['学会用断点调试而非打印', 15, 60]],
    [['把项目拆成 CMake 目标', 20, 90], ['写一份能复现的构建说明', 10, 40]],
    [['创建窗口并处理关闭事件', 20, 90], ['接入键盘输入状态', 20, 90], ['读完事件循环资料', 10, 45]],
    [['初始化渲染上下文', 25, 120], ['加载并画出第一张纹理', 25, 120]],
    [['实现精灵表动画', 25, 120], ['加入帧率限制与计时器', 15, 60]],
    [['写 AABB 碰撞检测', 20, 90], ['搭一个可玩的小房间', 30, 150]],
    [['加入资源缓存', 20, 90], ['接入一个音效并做音量控制', 15, 60]],
    [['用 profiler 找一处卡顿', 25, 120], ['处理窗口缩放与高 DPI', 15, 60]],
    [['打包 Windows demo', 20, 90], ['写 800 字开发复盘', 20, 90]],
  ];

  for (let weekIndex = 0; weekIndex < cppWeekPlans.length; weekIndex += 1) {
    const weekStart = addWeeksISO(cppStart, weekIndex);
    for (const [title, points, estimateMin] of cppWeekPlans[weekIndex]) {
      const task = createTask(
        state,
        {
          projectId: cpp.id,
          title,
          detail: '把过程记录在项目笔记里，完成标准是能向别人讲清楚这一步。',
          weekStart,
          points,
          estimateMin,
          source: 'demo',
        },
        now,
      );
      if (weekIndex < 4) {
        completeTask(state, task.id, now);
        task.doneAt = addDaysISO(weekStart, 5) + 'T10:00:00.000Z';
      }
    }
  }

  const currentCppTasks = state.tasks.filter(
    (task) => task.projectId === cpp.id && task.weekStart === currentWeek,
  );
  if (currentCppTasks[0]) {
    completeTask(state, currentCppTasks[0].id, now);
    currentCppTasks[0].doneAt = addDaysISO(currentWeek, 1) + 'T10:00:00.000Z';
  }

  const photo = createProject(
    state,
    {
      title: '城市边缘 · 摄影集',
      goal: '六周做出一组 12 张的城市边缘影像，并排出一本 20 页的小册子。',
      startDate: photoStart,
      weeks: 6,
      source: 'demo',
    },
    now,
  );
  photo.color = '#9DB8A0';
  photo.weeksMeta = [
    { week: 1, theme: '定题与参考', outcome: '写下三个可拍摄的主题' },
    { week: 2, theme: '第一次扫街', outcome: '带回 80 张底片' },
    { week: 3, theme: '选片与结构', outcome: '选出 20 张初选' },
    { week: 4, theme: '补拍', outcome: '补足缺失的叙事镜头' },
    { week: 5, theme: '编辑与排版', outcome: '完成 20 页初版' },
    { week: 6, theme: '输出与复盘', outcome: '打印一本样册' },
  ];

  const photoPlan = [
    { week: 0, tasks: [['写三个拍摄主题', 10, 45], ['收集 10 组参考画册', 10, 45]] },
    { week: 1, tasks: [['扫街一次，拍满 80 张', 25, 180], ['给照片打星并写一句理由', 15, 60]] },
    { week: 2, tasks: [['初选 20 张', 20, 90], ['按时间/空间排三个顺序', 20, 90], ['补拍夜景缺口', 15, 120]] },
    { week: 3, tasks: [['完成 6 张的调色', 20, 120], ['写 200 字作品陈述', 15, 60]] },
    { week: 4, tasks: [['排出 20 页初版', 25, 150], ['给两位朋友看并记录反馈', 10, 45]] },
    { week: 5, tasks: [['修完最后一轮细节', 20, 90], ['打印样册', 15, 60]] },
  ];

  for (const plan of photoPlan) {
    const weekStart = addWeeksISO(photoStart, plan.week);
    for (const [title, points, estimateMin] of plan.tasks) {
      const task = createTask(
        state,
        {
          projectId: photo.id,
          title,
          detail: '完成后把文件放进本周的交付文件夹。',
          weekStart,
          points,
          estimateMin,
          source: 'demo',
        },
        now,
      );
      if (plan.week < 2) {
        completeTask(state, task.id, now);
        task.doneAt = addDaysISO(weekStart, 4) + 'T18:00:00.000Z';
      }
    }
  }

  const currentPhotoTasks = state.tasks.filter(
    (task) => task.projectId === photo.id && task.weekStart === currentWeek,
  );
  if (currentPhotoTasks[0]) {
    completeTask(state, currentPhotoTasks[0].id, now);
    currentPhotoTasks[0].doneAt = addDaysISO(currentWeek, 0) + 'T20:00:00.000Z';
  }

  // One deliberately unfinished task from last week, to show the catch-up flow.
  const overdue = createTask(
    state,
    {
      projectId: cpp.id,
      title: '补看一节内存布局的课程',
      detail: '上周留下的尾巴，可以并到本周，也可以让整个项目顺延。',
      weekStart: addWeeksISO(currentWeek, -1),
      points: 10,
      estimateMin: 45,
      source: 'demo',
    },
    now,
  );
  overdue.order = -1;

  // A small spending history so the wallet and ledger are not empty.
  const reward = state.rewards.find((item) => item.title.includes('奶茶'));
  if (reward) redeemReward(state, reward.id, now);

  repairLedger(state);
  state.meta.lastSeenWeek = currentWeek;
  state.meta.onboardingDismissed = true;
  return state;
}
