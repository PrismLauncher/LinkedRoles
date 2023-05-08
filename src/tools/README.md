This is a collection of tools which make development time easier.  They are meant to be executed from the cmdline. These can be run after cloning and building the repository:
```sh
$ yarn run build
$ cd build/src
$ node register-commands.js
```

### get-discord-metadata.ts <discord-user-id>
Get the metadata for the current user and this bot from Discord.  This is the data that will be used to verify role memberships and shown on profile badges. 
```sh
$ node get-discord-metadata.ts <discord-user-id>
```

### get-metadata-schema.ts
Get the schema configured in Discord for this verified role bot. 
```sh
$ node get-metadata-schema.ts
```

### get-profile.ts <github-user-id>
Fetch the user profile from Github.
```sh
$ node get-profile.ts <github-user-id>
```

### push-github-metadata.ts <github-user-id>
Fetch the user profile from Github, and then push the transformed metadata to Discord.
```sh
$ node push-github-metadata.ts <github-user-id>
```

### register-commands.ts
Register the slash commands used for this bot. 
```sh
$ node register-commands.ts
```

### register-metadata-schema.ts
Register the metadata schema used by verified roles for this bot. 
```sh
$ node register-metadata-schema.ts
```

