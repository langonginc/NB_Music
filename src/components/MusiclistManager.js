const axios = require('axios');
class MusiclistManager {
    constructor(playlistManager) {
        this.playlistManager = playlistManager;
        this.playlists = [];
        this.activePlaylistIndex = 0;
        this.lyricSearchType = 'auto';

        this.musicListContainer = document.querySelector(".content .music-list");
        this.playlistSection = this.musicListContainer.querySelector("#playlistList");
        this.songSection = this.musicListContainer.querySelector("#songList");
        this.newPlaylistBtn = this.musicListContainer.querySelector("#newPlaylist");

        // 先加载已保存的歌单
        this.loadPlaylists();
        // 确保所有歌单都有ID
        this.ensurePlaylistIds();

        // 只有当没有任何歌单时才创建默认歌单
        if (this.playlists.length === 0) {
            this.playlists.push({
                id: this.generateUUID(),
                name: this.playlistManager.playlistName || "默认歌单",
                songs: [...this.playlistManager.playlist]
            });
            this.savePlaylists();
        }

        this.init();
        this.loadLastPlayedPlaylist();
    }
    loadLastPlayedPlaylist() {
        const observer = new MutationObserver((mutations, obs) => {
            const playlistElement = this.playlistSection.querySelector(
                `li[data-id="${this.playlistManager.currentPlaylistId}"]`
            );
            if (playlistElement) {
                playlistElement.click();
                // 执行完成后立即断开观察器
                obs.disconnect();
            }
        });

        // 配置观察器
        observer.observe(this.playlistSection, {
            childList: true,      // 观察子节点的变化
            subtree: true         // 观察所有后代节点
        });
    }
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    ensurePlaylistIds() {
        this.playlists.forEach(playlist => {
            if (!playlist.id) {
                playlist.id = this.generateUUID();
            }
        });
        this.savePlaylists();
    }

    init() {
        const lyricSearchTypeSelect = document.getElementById('lyricSearchType');
        lyricSearchTypeSelect.addEventListener('change', (e) => {
            this.lyricSearchType = e.target.value;
        });
        // 点击新建歌单按钮事件
        this.newPlaylistBtn.addEventListener("click", () => {
            const input = document.createElement("input");
            input.type = "text";
            input.placeholder = "输入歌单名称";
            input.className = "playlist-input";

            input.addEventListener("click", (e) => {
                e.stopPropagation();
            });

            this.newPlaylistBtn.replaceWith(input);
            input.focus();

            const handleNewPlaylist = () => {
                const name = input.value.trim();
                if (name) {
                    // 检查歌单名是否已存在
                    if (this.playlists.some(p => p.name === name)) {
                        alert("歌单名称已存在！");
                        return;
                    }
                    this.playlists.push({
                        id: this.generateUUID(),
                        name: name,
                        songs: []
                    });
                    this.savePlaylists();
                    this.renderPlaylistList();
                }
                input.replaceWith(this.newPlaylistBtn);
            };

            input.addEventListener("blur", handleNewPlaylist);
            input.addEventListener("keypress", (e) => {
                if (e.key === "Enter") {
                    input.blur();
                }
            });
        });

        this.renderPlaylistList();
        this.renderSongList();
        const importBtn = document.getElementById('importPlaylist');
        const importDialog = document.getElementById('importDialog');
        const cancelBtn = document.getElementById('cancelImport');
        const confirmBtn = document.getElementById('confirmImport');
        const favLinkInput = document.getElementById('favLink');

        importBtn.addEventListener('click', () => {
            importDialog.classList.remove('hide');
            favLinkInput.focus();
        });

        cancelBtn.addEventListener('click', () => {
            importDialog.classList.add('hide');
            favLinkInput.value = '';
        });

        confirmBtn.addEventListener('click', async () => {
            const input = favLinkInput.value.trim();
            if (!input) {
                alert('请输入收藏夹链接或ID');
                return;
            }

            // 解析收藏夹ID
            let mediaId;
            if (/^\d+$/.test(input)) {
                // 直接输入的ID
                mediaId = input;
            } else {
                // 解析链接中的ID
                const match = input.match(/fid=(\d+)/);
                if (!match) {
                    alert('无法解析收藏夹ID，请确认输入格式正确');
                    return;
                }
                mediaId = match[1];
            }

            try {
                confirmBtn.disabled = true;
                confirmBtn.textContent = '导入中...';

                const result = await this.importFromBiliFav(mediaId);

                if (result.success) {
                    alert(result.message);
                    importDialog.classList.add('hide');
                    favLinkInput.value = '';
                    this.renderPlaylistList();
                } else {
                    alert(result.message);
                }
            } catch (error) {
                alert('导入失败: ' + error.message);
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.textContent = '导入';
            }
        });

        // 按ESC关闭对话框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !importDialog.classList.contains('hide')) {
                importDialog.classList.add('hide');
                favLinkInput.value = '';
            }
        });
    }

    loadPlaylists() {
        try {
            const savedPlaylists = localStorage.getItem("nbmusic_playlists");
            if (savedPlaylists) {
                this.playlists = JSON.parse(savedPlaylists);
                // 找到当前播放的歌单并设置为激活
                const activeIndex = this.playlists.findIndex(
                    p => p.name === this.playlistManager.playlistName
                );
                if (activeIndex !== -1) {
                    this.activePlaylistIndex = activeIndex;
                }
            }
        } catch (error) {
            console.error("加载歌单失败:", error);
            // 加载失败时重置为空数组
            this.playlists = [];
        }
    }

    savePlaylists() {
        try {
            localStorage.setItem("nbmusic_playlists", JSON.stringify(this.playlists));
        } catch (error) {
            console.error("保存歌单失败:", error);
        }
    }

    renderPlaylistList() {
        if (!this.playlistSection) return;
        this.playlistSection.innerHTML = "";

        this.playlists.forEach((playlist, index) => {
            const li = document.createElement("li");
            li.dataset.id = playlist.id;

            // 创建歌单名称容器
            const nameSpan = document.createElement("span");
            nameSpan.textContent = playlist.name;
            nameSpan.classList.add("playlist-name");
            li.appendChild(nameSpan);

            if (index === this.activePlaylistIndex) {
                li.classList.add("active");
            }

            // 创建按钮容器
            const buttonContainer = document.createElement("div");
            buttonContainer.classList.add("playlist-buttons");

            // 重命名按钮
            const renameBtn = document.createElement("i");
            renameBtn.classList.add("bi", "bi-pencil-square");
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                this.renamePlaylist(playlist.id);
            };

            // 删除按钮
            const deleteBtn = document.createElement("i");
            deleteBtn.classList.add("bi", "bi-trash");
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.deletePlaylist(playlist.id);
            };

            buttonContainer.appendChild(renameBtn);
            buttonContainer.appendChild(deleteBtn);
            li.appendChild(buttonContainer);

            li.addEventListener("click", () => {
                this.activePlaylistIndex = index;
                this.playlistManager.playlistName = playlist.name;
                this.playlistManager.playlist = [...playlist.songs];
                this.playlistManager.currentPlaylistId = playlist.id;
                this.playlistManager.savePlaylists();
                this.playlistManager.uiManager.renderPlaylist();
                this.playlistManager.setPlayingNow(0);
                this.renderPlaylistList();
                this.renderSongList();
            });

            this.playlistSection.appendChild(li);
        });
    }

    renderSongList() {
        if (!this.songSection) return;
        this.songSection.innerHTML = "";

        const activePlaylist = this.playlists[this.activePlaylistIndex];
        if (!activePlaylist) return;

        activePlaylist.songs.forEach((song, idx) => {
            const li = document.createElement("li");

            // 创建歌曲信息容器
            const songInfo = document.createElement("div");
            songInfo.classList.add("song-info");

            // 添加封面
            const cover = document.createElement("img");
            cover.src = song.poster;
            cover.alt = "歌曲封面";
            cover.classList.add("song-cover");

            // 添加标题
            const title = document.createElement("span");
            title.textContent = song.title || "未知歌曲";
            title.classList.add("song-title");

            // 组装歌曲信息
            songInfo.appendChild(cover);
            songInfo.appendChild(title);
            li.appendChild(songInfo);

            li.addEventListener("click", () => {
                this.playlistManager.playlistName = activePlaylist.name;
                this.playlistManager.playlist = [...activePlaylist.songs];
                this.playlistManager.setPlayingNow(idx);
                document.querySelector(".player").click();
            });

            const delBtn = document.createElement("i");
            delBtn.classList.add("bi", "bi-trash");
            delBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                activePlaylist.songs.splice(idx, 1);

                if (this.playlistManager.playlistName === activePlaylist.name) {
                    this.playlistManager.playlist = [...activePlaylist.songs];
                }
                this.savePlaylists();
                this.renderSongList();
                this.playlistManager.uiManager.renderPlaylist();
            });

            li.appendChild(delBtn);
            this.songSection.appendChild(li);
        });
    }

    renamePlaylist(playlistId) {
        const playlist = this.playlists.find(p => p.id === playlistId);
        if (!playlist) return;

        const playlistItem = document.querySelector(`li[data-id="${playlistId}"]`);
        const nameSpan = playlistItem.querySelector('.playlist-name');
        const originalName = nameSpan.textContent;

        // 创建输入框
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalName;
        input.className = 'playlist-input';
        input.style.width = 'calc(100% - 60px)';
        input.addEventListener("click", (e) => {
            e.stopPropagation();
        });

        // 替换原来的名称
        nameSpan.replaceWith(input);
        input.focus();

        const handleRename = () => {
            const newName = input.value.trim();
            if (newName && newName !== originalName) {
                if (this.playlists.some(p => p.id !== playlistId && p.name === newName)) {
                    alert("歌单名称已存在！");
                    input.replaceWith(nameSpan);
                    return;
                }
                playlist.name = newName;
                if (this.playlistManager.playlistName === originalName) {
                    this.playlistManager.playlistName = newName;
                }
                this.savePlaylists();
                this.renderPlaylistList();
            } else {
                input.replaceWith(nameSpan);
            }
        };

        input.addEventListener('blur', handleRename);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                input.replaceWith(nameSpan);
            }
        });
    }

    deletePlaylist(playlistId) {
        const index = this.playlists.findIndex(p => p.id === playlistId);
        if (index === -1) return;
    
        const deleteBtn = document.querySelector(`li[data-id="${playlistId}"] .bi-trash`);
    
        // 如果已经是确认状态
        if (deleteBtn.classList.contains('confirm-delete')) {
            // 如果删除的是当前播放的歌单
            if (index === this.activePlaylistIndex) {
                // 优先选择前一个歌单，如果不存在则选择后一个歌单
                let newIndex;
                if (index > 0) {
                    newIndex = index - 1;
                } else if (this.playlists.length > 1) {
                    newIndex = 1; // 选择下一个歌单
                }
    
                // 删除歌单
                this.playlists.splice(index, 1);
    
                if (typeof newIndex === 'undefined') {
                    // 如果没有其他歌单，创建默认歌单
                    const defaultPlaylist = {
                        id: this.generateUUID(),
                        name: "默认歌单",
                        songs: []
                    };
                    this.playlists.push(defaultPlaylist);
                    this.activePlaylistIndex = 0;
                    this.playlistManager.playlistName = defaultPlaylist.name;
                    this.playlistManager.playlist = [];
                    this.playlistManager.currentPlaylistId = defaultPlaylist.id;
                } else {
                    // 切换到新选择的歌单
                    this.activePlaylistIndex = newIndex;
                    const newPlaylist = this.playlists[newIndex];
                    this.playlistManager.playlistName = newPlaylist.name;
                    this.playlistManager.playlist = [...newPlaylist.songs];
                    this.playlistManager.currentPlaylistId = newPlaylist.id;
                }
    
                // 更新播放状态和UI
                this.playlistManager.setPlayingNow(0);
                this.playlistManager.savePlaylists();
            } else {
                // 如果删除的不是当前播放的歌单
                this.playlists.splice(index, 1);
                if (index < this.activePlaylistIndex) {
                    this.activePlaylistIndex--;
                }
            }
    
            this.savePlaylists();
            this.renderPlaylistList();
            this.renderSongList();
            return;
        }
    
        // 第一次点击，显示确认状态
        deleteBtn.classList.add('confirm-delete');
        deleteBtn.style.color = 'red';
    
        // 创建确认文本
        const confirmText = document.createElement('span');
        confirmText.textContent = '再次点击确认删除';
        confirmText.style.cssText = `
            color: red;
            font-size: 12px;
            margin-left: 5px;
        `;
        deleteBtn.parentNode.appendChild(confirmText);
    
        // 3秒后恢复原状
        setTimeout(() => {
            deleteBtn.classList.remove('confirm-delete');
            deleteBtn.style.color = '';
            if (confirmText.parentNode) {
                confirmText.remove();
            }
        }, 3000);
    }

    handlePlaylistUpdate() {
        const activePlaylist = this.playlists[this.activePlaylistIndex];
        if (activePlaylist && activePlaylist.name === this.playlistManager.playlistName) {
            // 深拷贝当前播放列表的歌曲到激活的歌单
            activePlaylist.songs = JSON.parse(JSON.stringify(this.playlistManager.playlist));
            // 保存更新后的歌单
            this.savePlaylists();
        }

        this.renderPlaylistList();
        this.renderSongList();
    }
    async importFromBiliFav(mediaId) {
        try {
            // 1. 获取收藏夹信息保持不变
            const favResponse = await axios.get(`https://api.bilibili.com/x/v3/fav/folder/info?media_id=${mediaId}`);
            if (favResponse.data.code !== 0) {
                throw new Error('获取收藏夹信息失败');
            }

            const favInfo = favResponse.data.data;
            const totalCount = favInfo.media_count;
            const pageSize = 20;
            const totalPages = Math.ceil(totalCount / pageSize);

            // 创建新歌单
            const playlistTitle = `${favInfo.title}`;
            const playlistIndex = this.playlists.length;
            this.playlists.push({
                id: this.generateUUID(),
                name: playlistTitle,
                songs: []
            });

            // 2. 收集所有要添加的歌曲信息
            const songsToAdd = [];

            for (let page = 1; page <= totalPages; page++) {
                const resourcesResponse = await axios.get(
                    `https://api.bilibili.com/x/v3/fav/resource/list?media_id=${mediaId}&pn=${page}&ps=${pageSize}&platform=web`
                );

                if (resourcesResponse.data.code !== 0) continue;

                const medias = resourcesResponse.data.data.medias;
                if (!medias) continue;

                // 3. 对每个视频获取cid
                for (const media of medias) {
                    if (media.attr === 1) continue; // 跳过失效视频

                    try {
                        // 获取视频cid
                        const cidResponse = await axios.get(`https://api.bilibili.com/x/web-interface/view?bvid=${media.bvid}`);
                        if (cidResponse.data.code === 0) {
                            songsToAdd.push({
                                title: media.title,
                                artist: media.upper.name,
                                bvid: media.bvid,
                                cid: cidResponse.data.data.cid, // 设置cid
                                duration: media.duration,
                                poster: media.cover,
                                audio: null // 音频链接需要在播放时获取
                            });
                        }
                    } catch (error) {
                        console.warn(`获取视频 ${media.bvid} 的CID失败:`, error);
                        continue;
                    }
                }
            }

            // 4. 并行获取所有歌词
            console.log(`开始获取 ${songsToAdd.length} 首歌的歌词...`);

            const songsWithLyrics = [];
            for (const song of songsToAdd) {
                try {
                    let lyric;
                    if (this.lyricSearchType === 'custom') {
                        // 显示歌词搜索对话框
                        lyric = await this.showLyricSearchDialog(song);
                    } else {
                        // 使用默认标题搜索
                        lyric = await window.app.musicSearcher.getLyrics(song.title);
                    }

                    songsWithLyrics.push({
                        ...song,
                        lyric: lyric || "暂无歌词，尽情欣赏音乐"
                    });
                } catch (error) {
                    console.warn(`获取歌词失败: ${song.title}`, error);
                    songsWithLyrics.push({
                        ...song,
                        lyric: "暂无歌词，尽情欣赏音乐"
                    });
                }
            }


            // 5. 将带有歌词的歌曲添加到播放列表
            this.playlists[playlistIndex].songs = songsWithLyrics;

            // 6. 触发UI更新和保存
            this.handlePlaylistUpdate();
            this.savePlaylists();

            return {
                success: true,
                message: `成功导入 ${songsWithLyrics.length} 首歌曲到歌单"${playlistTitle}"`
            };

        } catch (error) {
            console.error('从B站收藏夹导入失败:', error);
            return {
                success: false,
                message: '导入失败: ' + error.message
            };
        }
    }
    async showLyricSearchDialog(song) {
        return new Promise((resolve) => {
            const dialog = document.getElementById('lyricSearchDialog');
            const titleDiv = document.getElementById('currentSongTitle');
            const keywordInput = document.getElementById('lyricKeyword');
            const skipBtn = document.getElementById('skipLyric');
            const confirmBtn = document.getElementById('confirmLyric');

            // 显示当前歌曲信息
            titleDiv.textContent = song.title;
            keywordInput.value = song.title;
            dialog.classList.remove('hide');

            const handleSkip = () => {
                cleanup();
                resolve("暂无歌词，尽情欣赏音乐");
            };

            const handleConfirm = async () => {
                const keyword = keywordInput.value.trim();
                cleanup();
                if (keyword) {
                    try {
                        const lyric = await window.app.musicSearcher.getLyrics(keyword);
                        resolve(lyric);
                    } catch (error) {
                        resolve("暂无歌词，尽情欣赏音乐");
                    }
                } else {
                    resolve("暂无歌词，尽情欣赏音乐");
                }
            };

            const handleKeydown = (e) => {
                if (e.key === 'Enter') {
                    handleConfirm();
                } else if (e.key === 'Escape') {
                    handleSkip();
                }
            };

            const cleanup = () => {
                dialog.classList.add('hide');
                skipBtn.removeEventListener('click', handleSkip);
                confirmBtn.removeEventListener('click', handleConfirm);
                keywordInput.removeEventListener('keydown', handleKeydown);
            };

            skipBtn.addEventListener('click', handleSkip);
            confirmBtn.addEventListener('click', handleConfirm);
            keywordInput.addEventListener('keydown', handleKeydown);

            // 聚焦输入框
            keywordInput.focus();
            keywordInput.select();
        });
    }
}

module.exports = MusiclistManager;