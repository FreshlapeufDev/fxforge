export const FRAMEWORKS = {
  standalone: {
    label: 'Standalone',
    dependencies: [],
    preload: [],
    bridgeServer: () => `Bridge = {}

function Bridge.GetIdentifier(source)
    return GetPlayerIdentifierByType(source, 'license')
end

function Bridge.Notify(source, message)
    TriggerClientEvent('chat:addMessage', source, {
        args = { GetCurrentResourceName(), message }
    })
end
`,
    bridgeClient: () => `Bridge = {}

function Bridge.Notify(message)
    BeginTextCommandThefeedPost('STRING')
    AddTextComponentSubstringPlayerName(message)
    EndTextCommandThefeedPostTicker(false, true)
end
`,
  },
  esx: {
    label: 'ESX Legacy',
    dependencies: ['es_extended'],
    preload: [],
    bridgeServer: () => `local ESX = exports['es_extended']:getSharedObject()

Bridge = {}

function Bridge.GetIdentifier(source)
    local xPlayer = ESX.GetPlayerFromId(source)
    return xPlayer and xPlayer.getIdentifier() or nil
end

function Bridge.Notify(source, message)
    TriggerClientEvent('esx:showNotification', source, message)
end
`,
    bridgeClient: () => `local ESX = exports['es_extended']:getSharedObject()

Bridge = {}

function Bridge.Notify(message)
    ESX.ShowNotification(message)
end
`,
  },
  qbcore: {
    label: 'QBCore',
    dependencies: ['qb-core'],
    preload: [],
    bridgeServer: () => `local QBCore = exports['qb-core']:GetCoreObject()

Bridge = {}

function Bridge.GetIdentifier(source)
    local player = QBCore.Functions.GetPlayer(source)
    return player and player.PlayerData.citizenid or nil
end

function Bridge.Notify(source, message)
    TriggerClientEvent('QBCore:Notify', source, message)
end
`,
    bridgeClient: () => `local QBCore = exports['qb-core']:GetCoreObject()

Bridge = {}

function Bridge.Notify(message)
    QBCore.Functions.Notify(message)
end
`,
  },
  qbox: {
    label: 'Qbox',
    dependencies: ['ox_lib', 'qbx_core'],
    preload: ['@ox_lib/init.lua'],
    bridgeServer: () => `Bridge = {}

function Bridge.GetIdentifier(source)
    local player = exports.qbx_core:GetPlayer(source)
    return player and player.PlayerData.citizenid or nil
end

function Bridge.Notify(source, message)
    exports.qbx_core:Notify(source, message)
end
`,
    bridgeClient: () => `Bridge = {}

function Bridge.Notify(message)
    exports.qbx_core:Notify(message)
end
`,
  },
};

export const NUI_KINDS = {
  none: 'No interface',
  vanilla: 'HTML / CSS / JS (no build step)',
  vite: 'Vite + TypeScript',
};
