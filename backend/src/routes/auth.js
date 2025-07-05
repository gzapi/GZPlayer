import express from 'express';
import { User, UserSession } from '../models/index.js'; // ajuste o caminho conforme seu projeto
import { Op } from 'sequelize'; // se usar Sequelize para query complexa
import dotenv from 'dotenv';

dotenv.config();

const authRouter = express.Router();

function validateEmail(email) {
    const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return pattern.test(email);
}

function validatePassword(password) {
    if (password.length < 6) {
        return [false, 'Senha deve ter pelo menos 6 caracteres'];
    }

    if (!/[A-Za-z]/.test(password)) {
        return [false, 'Senha deve conter pelo menos uma letra'];
    }

    if (!/\d/.test(password)) {
        return [false, 'Senha deve conter pelo menos um número'];
    }

    return [true, 'Senha válida'];
}

authRouter.post('/register', async (req, res) => {
    try {
        const { username, email, password, first_name = '', last_name = '' } = req.body;

        // Validação campos obrigatórios
        if (!username || !email || !password) {
            return res.status(400).json({ success: false, message: 'username, email e password são obrigatórios' });
        }

        if (username.trim().length < 3) {
            return res.status(400).json({ success: false, message: 'Nome de usuário deve ter pelo menos 3 caracteres' });
        }

        if (!validateEmail(email)) {
            return res.status(400).json({ success: false, message: 'Email inválido' });
        }

        const [validPwd, pwdMsg] = validatePassword(password);

        if (!validPwd) {
            return res.status(400).json({ success: false, message: pwdMsg });
        }

        // Verificar usuário existente
        const existingUser = await User.findOne({
            where: {
                [Op.or]: [
                    { username: username.trim() },
                    { email: email.trim().toLowerCase() }
                ]
            }
        });

        if (existingUser) {
            if (existingUser.username === username.trim()) {
                return res.status(409).json({ success: false, message: 'Nome de usuário já está em uso' });
            }

            return res.status(409).json({ success: false, message: 'Email já está em uso' });
        }

        // Criar usuário (supondo que User.setPassword faça o hash)
        const user = await User.create({
            username: username.trim(),
            email: email.trim().toLowerCase(),
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            password // você pode precisar chamar user.setPassword(password) e salvar depois
        });

        // Criar sessão
        const session = await UserSession.create({
            user_id: user.id,
            expires_at: new Date(Date.now() + 3600000),
            user_agent: req.headers['user-agent'] || '',
            ip_address: req.ip
        });

        return res.status(201).json({
            success: true,
            message: 'Usuário criado com sucesso',
            user: user.toJSON(),
            tokens
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
    }
});

authRouter.post('/login', async (req, res) => {
    try {
        const { login, password } = req.body;

        if (!login || !password) {
            return res.status(400).json({ success: false, message: 'Login e senha são obrigatórios' });
        }

        const user = await User.findOne({
            where: {
                [Op.or]: [
                    { username: login.trim() },
                    { email: login.trim().toLowerCase() }
                ]
            }
        });

        if (!user || !(await user.checkPassword(password))) {
            return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
        }

        if (!user.is_active) {
            return res.status(401).json({ success: false, message: 'Conta desativada' });
        }

        user.last_login = new Date();
        await user.save();

        await UserSession.create({
            user_id: user.id,
            expires_at: new Date(Date.now() + 3600000),
            user_agent: req.headers['user-agent'] || '',
            ip_address: req.ip
        });

        return res.status(200).json({
            success: true,
            message: 'Login realizado com sucesso',
            user: user.toJSON()
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
    }
});

authRouter.post('/logout', async (req, res) => {
    try {
        const session = await UserSession.findOne({
            where: {
                user_id: req.userId,
                is_active: true
            }
        });

        if (session) {
            session.is_active = false;
            await session.save();
        }

        return res.status(200).json({ success: true, message: 'Logout realizado com sucesso' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro ao fazer logout', error: error.message });
    }
});

authRouter.get('/me', async (req, res) => {
    try {
        const user = await User.findByPk(req.userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        return res.status(200).json({ success: true, user: user.toJSON() });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro ao buscar usuário', error: error.message });
    }
});

authRouter.post('/change-password', async (req, res) => {
    try {
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({ success: false, message: 'Senha atual e nova senha são obrigatórias' });
        }

        const user = await User.findByPk(req.userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        if (!(await user.checkPassword(current_password))) {
            return res.status(401).json({ success: false, message: 'Senha atual incorreta' });
        }

        const [validPwd, pwdMsg] = validatePassword(new_password);
        if (!validPwd) {
            return res.status(400).json({ success: false, message: pwdMsg });
        }

        await user.setPassword(new_password);
        await user.save();

        // Desativar sessões ativas
        await UserSession.update(
            { is_active: false },
            { where: { user_id: user.id, is_active: true } }
        );

        return res.status(200).json({ success: true, message: 'Senha alterada com sucesso' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro ao alterar senha', error: error.message });
    }
});

export default authRouter;