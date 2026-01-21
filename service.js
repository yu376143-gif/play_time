const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));

const COLORS = ['#007AFF', '#FF2D55', '#34C759', '#5856D6', '#FF9500', '#00C7BE'];
let users = {};
let globalKeystrokes = 0; // 全局计数器

io.on('connection', (socket) => {
    // 初始化新用户
    users[socket.id] = {
        id: socket.id,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        keystrokes: 0
    };

    // 1. 发送当前世界状态给新用户
    socket.emit('init_stats', globalKeystrokes);
    io.emit('update_users', users);

    // 2. 键盘事件 (核心修复)
    socket.on('key_press', (data) => {
    if(users[socket.id]) {
        if(data.state === 'down') {
            users[socket.id].keystrokes++;
            globalKeystrokes++;
            // 实时发送全局总数
            io.emit('global_count', globalKeystrokes);
            
            // 为了降低延迟，每 2-3 次击键就同步一次，或者干脆只同步当前这一个人的数字
            // 推荐发送一个小型的增量更新，而不是整个 users 对象
            io.emit('individual_update', { id: socket.id, count: users[socket.id].keystrokes });
        }
        
        socket.broadcast.emit('remote_input', {
            type: 'key', id: socket.id, code: data.code, state: data.state
        });
    }
});

    // 3. 鼠标移动
    socket.on('mouse_move', (pos) => {
        socket.broadcast.volatile.emit('remote_input', {
            type: 'mouse',
            id: socket.id,
            x: pos.x,
            y: pos.y
        });
    });

    // 4. 其他交互
    socket.on('change_color', (c) => {
        if(users[socket.id]) {
            users[socket.id].color = c;
            io.emit('update_users', users);
        }
    });

    socket.on('msg_sent', (txt) => {
        io.emit('spawn_obj', { type: 'msg', id: socket.id, val: txt });
    });

    socket.on('emoji_sent', (d) => {
        socket.broadcast.emit('spawn_obj', { type: 'emoji', x: d.x, y: d.y, val: d.val });
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('update_users', users);
    });
});

http.listen(3000, '0.0.0.0', () => {
    console.log('Ether Compass Server Running on :3000');
});