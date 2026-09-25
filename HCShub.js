const {
    Client,
    GatewayIntentBits,
    PermissionFlagsBits,
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const licensePath = path.join(__dirname, 'licenses.json');
let licensesData = {};

if (fs.existsSync(licensePath)) {
    try { licensesData = JSON.parse(fs.readFileSync(licensePath, 'utf8')); } catch (e) {}
}

function saveLicenses() {
    fs.writeFileSync(licensePath, JSON.stringify(licensesData, null, 2), 'utf8');
}
function isAdmin(member) {
    return member?.permissions?.has(PermissionFlagsBits.Administrator);
}

// ==========================================
// Express API 엔드포인트
// ==========================================

// 1. 허브 정보 및 유저 인증 API (/api/hub)
app.get('/api/hub', (req, res) => {
    const robloxName = req.query.roblox;
    if (!robloxName) {
        return res.json({ success: false, message: "roblox 쿼리가 누락되었습니다." });
    }

    let matchedLicense = null;
    for (const [uid, data] of Object.entries(licensesData)) {
        if (data.robloxName === robloxName) {
            matchedLicense = data;
            break;
        }
    }

    if (!matchedLicense) {
        return res.json({ success: false, message: "등록되지 않은 유저입니다." });
    }

    res.json({
        success: true,
        robloxName: robloxName,
        discordName: matchedLicense.discordName || "HCS User",
        discordPfp: matchedLicense.discordPfp || "https://cdn.discordapp.com/embed/avatars/0.png",
        products: matchedLicense.products || []
    });
});

// 2. 실행 로그 기록 API (/api/log)
app.get('/api/log', (req, res) => {
    const robloxName = req.query.roblox;
    const product = req.query.product;
    console.log(`[LOG] 사용자 [${robloxName}] 님이 [${product}] 스크립트를 구동했습니다.`);
    res.json({ success: true });
});

// 3. 공개 스크립트 연결 API (/api/script) - 깃허브 Raw 링크 직접 활용
app.get('/api/script', async (req, res) => {
    const robloxName = req.query.roblox;
    const productId = req.query.product;

    if (!robloxName || !productId) {
        return res.status(400).send("print('잘못된 요청입니다.')");
    }

    // 공개 저장소의 Raw 링크 매핑 (저장소 이름이 다르면 여기 주소만 맞게 수정하시면 됩니다)
    const scriptUrls = {
        pc_v1: "https://raw.githubusercontent.com/nuanua0304-cpu/HCS-UNSCRIPT/main/pc_v1.lua",
        pc_v2: "https://raw.githubusercontent.com/nuanua0304-cpu/HCS-UNSCRIPT/main/pc_v2.lua",
        pc_v3: "https://raw.githubusercontent.com/nuanua0304-cpu/HCS-UNSCRIPT/main/pc_v3.lua",
        mov_v1: "https://raw.githubusercontent.com/nuanua0304-cpu/HCS-UNSCRIPT/main/mov_v1.lua",
        mov_v2: "https://raw.githubusercontent.com/nuanua0304-cpu/HCS-UNSCRIPT/main/mov_v2.lua",
        mov_v3: "https://raw.githubusercontent.com/nuanua0304-cpu/HCS-UNSCRIPT/main/mov_v3.lua",
        tdc: "https://raw.githubusercontent.com/nuanua0304-cpu/HCS-UNSCRIPT/main/tdc.lua",
        mp: "https://raw.githubusercontent.com/nuanua0304-cpu/HCS-UNSCRIPT/main/mp.lua",
        vip: "https://raw.githubusercontent.com/nuanua0304-cpu/HCS-UNSCRIPT/main/vip.lua"
    };

    const targetUrl = scriptUrls[productId];

    if (!targetUrl) {
        return res.status(404).send("print('존재하지 않는 스크립트입니다.')");
    }

    try {
        const response = await fetch(targetUrl);

        if (!response.ok) {
            throw new Error(`GitHub fetch error: ${response.status}`);
        }

        const scriptText = await response.text();

        if (!scriptText || scriptText.trim() === "") {
            throw new Error("스크립트 내용이 비어 있습니다.");
        }

        console.log(`[SCRIPT] ${robloxName} ->${productId} 로드 성공`);
        res.type('text/plain').send(scriptText);

    } catch (err) {
        console.error("[GITHUB] 스크립트 로드 오류:", err);
        res.status(500).send("print('스크립트 로드 중 오류가 발생했습니다.')");
    }
});

app.listen(PORT, () => {
    console.log(`[EXPRESS] 서버가 포트 ${PORT}에서 구동되었습니다! 🚀`);
});

// ==========================================
// Discord 봇 설정
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const productChoices = [
    { name: 'PC V1', value: 'pc_v1' },
    { name: 'PC V2', value: 'pc_v2' },
    { name: 'PC V3', value: 'pc_v3' },
    { name: 'Mobile V1', value: 'mov_v1' },
    { name: 'Mobile V2', value: 'mov_v2' },
    { name: 'Mobile V3', value: 'mov_v3' },
    { name: 'TDC', value: 'tdc' },
    { name: 'MP', value: 'mp' },
    { name: 'VIP', value: 'vip' }
];

const commands = [
    new SlashCommandBuilder()
        .setName('라이센스영구')
        .setDescription('디스코드 유저에게 로블록스 닉네임과 제품을 연동하여 영구 라이센스를 부여합니다.')
        .addUserOption(o => o.setName('유저').setDescription('대상 디스코드 유저').setRequired(true))
        .addStringOption(o => o.setName('로블록스닉네임').setDescription('연동할 로블록스 닉네임').setRequired(true))
        .addStringOption(o => o.setName('제품').setDescription('부여할 제품 선택').setRequired(true).addChoices(...productChoices)),
    new SlashCommandBuilder()
        .setName('라이센스제거')
        .setDescription('특정 디스코드 유저의 라이센스를 제거합니다.')
        .addUserOption(o => o.setName('유저').setDescription('대상 디스코드 유저').setRequired(true))
];

client.once('ready', async () => {
    console.log(`[DISCORD] 봇 로그인 성공: ${client.user.tag}`);
    try {
        const finalCommands = commands.map(cmd => cmd.setDefaultMemberPermissions(PermissionFlagsBits.Administrator));
        await client.application.commands.set(finalCommands);
        console.log('✅ 슬래시 명령어 등록 완료');
    } catch (e) {
        console.error('명령어 등록 오류:', e);
    }
});

client.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;
    if (!isAdmin(i.member)) {
        return await i.reply({ content: '❌ 관리자 권한이 필요합니다.', flags: 64 });
    }

    try {
        await i.deferReply({ flags: 64 });

        if (i.commandName === '라이센스영구') {
            const targetUser = i.options.getUser('유저');
            const robloxName = i.options.getString('로블록스닉네임');
            const product = i.options.getString('제품');

            licensesData[targetUser.id] = {
                robloxName: robloxName,
                discordName: targetUser.username,
                discordPfp: targetUser.displayAvatarURL({ extension: 'png', size: 256 }),
                products: [product]
            };
            saveLicenses();

            const embed = new EmbedBuilder()
                .setTitle('🌐 영구 라이센스 연동 완료')
                .setDescription(`- **디스코드 유저**: ${targetUser}\n- **로블록스 닉네임**: \`${robloxName}\`\n- **부여된 제품**: \`${product}\``)
                .setThumbnail(targetUser.displayAvatarURL())
                .setColor('#0099FF');
            return await i.editReply({ embeds: [embed] });
        }

        if (i.commandName === '라이센스제거') {
            const targetUser = i.options.getUser('유저');
            if (!licensesData[targetUser.id]) {
                return await i.editReply({ content: '❌ 등록된 라이센스가 없는 유저입니다.' });
            }
            delete licensesData[targetUser.id];
            saveLicenses();
            return await i.editReply({ content: `✅ ${targetUser}님의 라이센스가 제거되었습니다.` });
        }
    } catch (err) {
        await i.editReply({ content: '❌ 명령어 실행 중 오류가 발생했습니다.' }).catch(() => {});
    }
});

// 봇 로그인 처리 (.trim()으로 공백 에러 방지)
console.log("[DISCORD] 봇 로그인을 시도합니다...");
const botToken = process.env.TOKEN ? process.env.TOKEN.trim() : "";

if (!botToken) {
    console.error("[DISCORD ERROR] TOKEN 환경 변수가 비어있습니다!");
} else {
    client.login(botToken).catch(err => {
        console.error("[DISCORD LOGIN ERROR] 봇 로그인 실패:", err);
    });
}
