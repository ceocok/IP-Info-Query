let map;
let userMarker;     // 用于标记用户位置
let queryMarker;    // 用于标记查询结果的位置
let queryLine;      // 用于连接两个位置的线
let userLocation = null; // **【新增】** 用于存储用户位置坐标，这是解决问题的关键

function loadMapScenario() {
    // 1. 定义不同的地图图层
    const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, etc.'
    });

    const streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });

    // 2. 初始化地图，并默认加载卫星地图
    map = L.map('map-container', {
        center: [39.9042, 116.4074],
        zoom: 5,
        layers: [satelliteMap] // 默认显示的图层
    });

    // 3. 创建图层组，用于切换控件
    const baseLayers = {
        "卫星地图": satelliteMap,
        "街道地图": streetMap
    };

    // 4. 添加图层切换控件到地图上
    L.control.layers(baseLayers).addTo(map);
    
    // 原有的功能函数
    getUserLocation(); // 在页面加载时获取一次用户位置
    getUserIP();
    getBlockedSiteIP();
    getResultData();
    updateHistoryList();
}


function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                // **【修改】** 将获取到的位置存储在全局变量中
                userLocation = [latitude, longitude]; 

                map.setView(userLocation, 16);

                if (userMarker) {
                    userMarker.remove();
                }

                userMarker = L.marker(userLocation).addTo(map)
                    .bindPopup("<b>您的位置</b>").openPopup();
            },
            (error) => {
                // 如果获取失败，userLocation 将保持为 null
                console.error("无法获取您的位置，距离信息将不可用:", error.message);
            }
        );
    } else {
        console.error("您的浏览器不支持地理定位功能。");
    }
}

// ... getUserIP, getBlockedSiteIP... 函数保持不变 ...
function getUserIP() {
    fetch("https://ipapi.co/json/")
        .then((response) => response.json())
        .then((data) => {
            const userIpElem = document.getElementById("user-ip");
            userIpElem.textContent = `${data.ip} ${data.country} ${data.city}`;
        })
        .catch((error) => console.error(error));
}

function getBlockedSiteIP() {
    fetch("https://ipleak.net/json/")
        .then((response) => response.json())
        .then((data) => {
            const blockedSiteIpElem = document.getElementById("blocked-site-ip");
            blockedSiteIpElem.textContent = `${data.ip} ${data.country_name}`;
        })
        .catch((error) => console.error(error));
}



// 【最终正确版本】完全按照您的要求，只使用 ipv4_ct.itdog.cn
function getResultData() {
    fetch("https://ipv4_ct.itdog.cn")
        .then(response => {
            if (!response.ok) {
                // 如果网络请求本身就失败了（比如 404, 500），则抛出错误
                throw new Error(`网络响应失败: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            const resultElem = document.getElementById("result");
            
            // itdog 的成功返回示例: {"type":"success","version":"IPv4","ip":"...","address":"..."}
            if (data.type === 'success' && data.ip && data.address) {
                // 将 "中国/湖南/长沙/联通" 格式替换成空格分隔，然后显示
                const displayText = `${data.ip} ${data.address.replace(/\//g, " ")}`;
                resultElem.textContent = displayText;
            } else {
                // 如果返回的格式不对或有错误信息
                const errorMsg = data.message || '返回数据格式不正确';
                console.error("itdog API error:", errorMsg);
                resultElem.textContent = `获取国内 IP 信息失败: ${errorMsg}`;
            }
        })
        .catch(error => {
            console.error("获取国内 IP 数据时出错:", error);
            const resultElem = document.getElementById("result");
            resultElem.textContent = "获取国内 IP 信息失败，请检查网络或浏览器控制台。";
        });
}

// ... 您文件中的其他函数保持不变 ...



function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d.toFixed(2);
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}


function getDNSInfo() {
    const input = document.getElementById("domain-input").value.trim();
    if (!input) return;

    const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(input);
    const isIPv6 = /^[a-fA-F0-9:]+$/.test(input);

    const fetchIPData = (ip) => fetch(`https://ipapi.co/${ip}/json/`).then(response => response.json());

    const fetchDomainData = async (domain) => {
        let response = await fetch(`https://dns.alidns.com/resolve?name=${domain}&type=A`);
        let data = await response.json();
        if (!data.Answer || data.Answer.length === 0) {
            response = await fetch(`https://dns.alidns.com/resolve?name=${domain}&type=AAAA`);
            data = await response.json();
        }
        return data;
    };

    if (isIPv4 || isIPv6) {
        fetchIPData(input)
            .then(data => displayResult(data, input))
            .catch(error => {
                console.error("查询 IP 出错：", error);
                document.getElementById("query-result-container").innerHTML = "<p>查询失败，请输入有效的 IP 地址。</p>";
            });
    } else {
        fetchDomainData(input)
            .then(data => {
                if (!data.Answer || data.Answer.length === 0) throw new Error("无解析记录");
                const ipAddress = data.Answer[0].data;
                return fetchIPData(ipAddress);
            })
            .then(ipData => displayResult(ipData, ipData.ip))
            .catch(error => {
                console.error("查询域名出错：", error);
                document.getElementById("query-result-container").innerHTML = "<p>查询失败，请输入有效的域名。</p>";
            });
    }
}


// **【重点修改区域】**
function displayResult(data, input) {
    const resultContainer = document.getElementById("query-result-container");
    resultContainer.innerHTML =
        `<p>IP 地址：${data.ip || input}</p>` +
        `<p>归属地：${data.city || 'N/A'}, ${data.region || 'N/A'}, ${data.country_name || 'N/A'}</p>` +
        `<p>运营商：${data.org || 'N/A'}</p>`;

    // 检查API返回结果是否包含坐标信息
    if (!data.latitude || !data.longitude) {
        console.warn("查询结果缺少坐标信息，无法在地图上显示。");
        // 如果之前有查询标记，最好也移除掉
        if (queryMarker) queryMarker.remove();
        if (queryLine) queryLine.remove();
        return;
    }

    const targetLocation = [data.latitude, data.longitude];

    // 移除上一次的查询标记和连接线
    if (queryMarker) queryMarker.remove();
    if (queryLine) queryLine.remove();
    
    // 添加新的查询标记
    queryMarker = L.marker(targetLocation).addTo(map);

    // **【逻辑重构】**
    // 不再重新获取用户位置，而是检查 `userLocation` 变量是否已有值
    if (userLocation) {
        // 如果用户位置已知，则计算距离、画线、并显示完整信息
        const distance = getDistance(userLocation[0], userLocation[1], data.latitude, data.longitude);
        const popupContent = `<b>查询结果</b><br>距您 ${distance} 公里`;
        queryMarker.bindPopup(popupContent).openPopup();

        // 绘制连接线
        queryLine = L.polyline([userLocation, targetLocation], {
            color: 'blue',
            weight: 3,
            opacity: 0.7
        }).addTo(map);

        // 自动调整地图视野，以完整显示两个点和它们之间的线
        // 注意：这里的userMarker可能不存在，但我们有userLocation，所以可以创建一个包含两个点的边界
        const bounds = L.latLngBounds([userLocation, targetLocation]);
        map.fitBounds(bounds, { padding: [50, 50] });

    } else {
        // 如果用户位置未知（用户拒绝授权或获取失败）
        // 则只显示查询结果的位置，不显示距离和连线
        console.warn("用户位置未知，仅显示查询目标。");
        queryMarker.bindPopup("<b>查询结果</b>").openPopup();
        map.setView(targetLocation, 12);
    }

    saveToHistory(input);
}


// ... saveToHistory, updateHistoryList, searchLocationOnMap 和 事件监听器 保持不变 ...
function saveToHistory(query) {
    let history = JSON.parse(localStorage.getItem("queryHistory")) || [];
    if (!history.includes(query)) {
        history.push(query);
        localStorage.setItem("queryHistory", JSON.stringify(history));
        updateHistoryList();
    }
}

function updateHistoryList() {
    const history = JSON.parse(localStorage.getItem("queryHistory")) || [];
    const historyList = document.getElementById("history-list");
    historyList.innerHTML = "";
    history.forEach((item) => {
        const option = document.createElement("option");
        option.value = item;
        historyList.appendChild(option);
    });
}

// 注意: 这个函数 searchLocationOnMap 在您的HTML中没有被任何按钮调用，
// 如果您打算使用它，可能需要添加一个对应的按钮。
async function searchLocationOnMap() {
    const input = document.getElementById("domain-input").value.trim();
    if (input === "") return;

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input)}&format=json&limit=1`);
        const data = await response.json();

        if (data && data.length > 0) {
            const location = data[0];
            const coordinates = [parseFloat(location.lat), parseFloat(location.lon)];
            map.setView(coordinates, 12);

            // 使用 queryMarker 来显示地理搜索结果
            if (queryMarker) {
                queryMarker.remove();
            }
             // 如果有连接线，也一并移除
            if (queryLine) {
                queryLine.remove();
            }
            queryMarker = L.marker(coordinates).addTo(map).bindPopup(location.display_name).openPopup();
        }
    } catch (error) {
        console.error('Error with location search:', error);
    }
}

window.addEventListener("load", () => {
    // 延迟执行以确保地图容器已准备好
    setTimeout(loadMapScenario, 0); 
    
    const domainInput = document.getElementById("domain-input");
    domainInput.addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
            getDNSInfo();
        }
    });
});
