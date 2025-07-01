# WebPlayer Angular

Um player web moderno e completo para listas M3U com suporte a canais de TV, filmes e séries.

## 🚀 Funcionalidades Implementadas

### ✅ Estrutura Base
- **Framework**: Angular 19 com TypeScript
- **UI**: Angular Material Design
- **Arquitetura**: Componentes standalone e serviços injetáveis
- **Responsividade**: Interface adaptável para desktop e mobile

### ✅ Sistema de Navegação
- **Roteamento**: Navegação entre Canais, Filmes, Séries e Favoritos
- **Sidebar**: Menu lateral com navegação intuitiva
- **Header**: Barra superior com busca e controles

### ✅ Parser M3U
- **Carregamento**: Suporte a URLs M3U/M3U8
- **Classificação**: Separação automática entre canais, filmes e séries
- **Metadados**: Extração de informações como logo, grupo, etc.

### ✅ Sistema de Favoritos
- **Persistência**: Armazenamento local (localStorage)
- **Gerenciamento**: Adicionar/remover favoritos
- **Exportação**: Backup e importação de favoritos

### ✅ Temas
- **Tema Claro/Escuro**: Toggle automático
- **Detecção**: Preferência do sistema
- **Persistência**: Salva preferência do usuário

### ✅ Player de Vídeo
- **Video.js**: Player profissional integrado
- **Formatos**: Suporte a HLS (.m3u8), DASH (.mpd), MP4
- **Controles**: Play/pause, volume, tela cheia
- **Responsivo**: Adaptável a diferentes tamanhos

### ✅ Painel Lateral
- **Informações**: Detalhes do item selecionado
- **EPG**: Programação de canais (mock implementado)
- **Metadados**: Sinopse, ano, gênero, elenco
- **Favoritos**: Botão de favoritar integrado

### ✅ Interface de Usuário
- **Grid Responsivo**: Layout em cards adaptável
- **Busca**: Filtro em tempo real
- **Estados**: Loading, erro e vazio
- **Animações**: Transições suaves

## 🛠️ Tecnologias Utilizadas

- **Angular 19**: Framework principal
- **TypeScript**: Linguagem de programação
- **Angular Material**: Componentes UI
- **SCSS**: Estilização avançada
- **Video.js**: Player de vídeo
- **HLS.js**: Suporte a streaming HLS
- **RxJS**: Programação reativa

## 📁 Estrutura do Projeto

```
src/
├── app/
│   ├── components/          # Componentes da aplicação
│   │   ├── header/         # Cabeçalho com busca e temas
│   │   ├── channel-list/   # Lista de canais/filmes/séries
│   │   ├── video-player/   # Player de vídeo
│   │   └── side-panel/     # Painel lateral de informações
│   ├── services/           # Serviços da aplicação
│   │   ├── m3u-parser      # Parser de listas M3U
│   │   ├── favorites       # Gerenciamento de favoritos
│   │   ├── theme          # Sistema de temas
│   │   └── channel-info   # Informações de canais/EPG
│   ├── models/            # Interfaces e tipos
│   └── app.component.*    # Componente principal
└── styles.scss           # Estilos globais
```

## 🎯 Como Usar

1. **Iniciar a aplicação**:
   ```bash
   ng serve --host 0.0.0.0 --port 4200
   ```

2. **Carregar lista M3U**:
   - Insira a URL da lista M3U no campo lateral
   - Clique no botão de download
   - Os itens serão classificados automaticamente

3. **Navegar**:
   - Use o menu lateral para alternar entre seções
   - Clique nos cards para reproduzir conteúdo
   - Use a busca para filtrar itens

4. **Gerenciar favoritos**:
   - Clique no ícone de coração nos cards
   - Acesse a seção "Favoritos" para ver todos
   - Use o menu de opções para exportar/importar

## 🔧 Configurações

### Temas
- **Automático**: Detecta preferência do sistema
- **Manual**: Toggle no header
- **Persistente**: Salva escolha do usuário

### Player
- **Autoplay**: Configurável por item
- **Formatos**: HLS, DASH, MP4 suportados
- **Controles**: Personalizáveis via Video.js

## 📱 Responsividade

- **Desktop**: Layout completo com sidebar
- **Tablet**: Layout adaptado com navegação horizontal
- **Mobile**: Interface otimizada para toque

## 🔮 Funcionalidades Futuras

### Para capturar programa atual dos canais:
1. **APIs de EPG**: Integração com serviços como:
   - TV Guide API
   - EPG APIs específicas por região
   - Scrapers de sites de programação

2. **Exemplo de implementação**:
   ```typescript
   // No ChannelInfoService
   getCurrentProgram(channel: Channel): Observable<ProgramInfo> {
     const epgUrl = `https://api.epg.com/current?channel=${channel.tvgId}`;
     return this.http.get<ProgramInfo>(epgUrl);
   }
   ```

### Para filmes e séries:
1. **TMDB API**: The Movie Database
2. **OMDB API**: Open Movie Database
3. **TVMaze API**: Para informações de séries

### Melhorias adicionais:
- **Histórico**: Últimos assistidos
- **Recomendações**: Baseado em favoritos
- **Legendas**: Suporte a WebVTT
- **Chromecast**: Transmissão para TV
- **PWA**: Instalação como app

## 🚀 Deploy

Para fazer deploy da aplicação:

1. **Build de produção**:
   ```bash
   ng build --configuration production
   ```

2. **Servir arquivos estáticos**:
   - Use qualquer servidor web (Nginx, Apache, etc.)
   - Aponte para a pasta `dist/webplayer-angular`

## 📄 Licença

Este projeto foi desenvolvido como demonstração de um webplayer completo em Angular.

---

**Desenvolvido com ❤️ usando Angular e Material Design**

