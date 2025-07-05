import express from 'express';
import { User } from '../models/index.js';

const userRouter = express.Router();

userRouter.get('/', async (req, res) => {
    try {
        const users = await User.findAll();
        return res.status(200).json(users.map(user => user.toJSON()));
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro ao buscar usuários', error: error.message });
    }
});

userRouter.post('/', async (req, res) => {
    try {
        const { username, email } = req.body;

        if (!username || !email) {
            return res.status(400).json({ success: false, message: 'Username e e-mail são obrigatórios' });
        }

        const user = await User.create({ username, email });

        return res.status(201).json(user.toJSON());
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro ao criar usuário', error: error.message });
    }
});

userRouter.get('/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        return res.status(200).json(user.toJSON());
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro ao buscar usuário', error: error.message });
    }
});

userRouter.put('/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        const { username, email } = req.body;

        user.username = username ?? user.username;
        user.email = email ?? user.email;

        await user.save();

        return res.status(200).json(user.toJSON());
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro ao atualizar usuário', error: error.message });
    }
});

userRouter.delete('/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        await user.destroy();

        return res.status(204).send();
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro ao excluir usuário', error: error.message });
    }
});

export default userRouter;