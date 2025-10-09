import * as path from 'path';
import { lstatFile, readdir } from './asyncUtil';
import { isSubPath } from './pathUtil';

const state = {
    hasIgnore: false,
    hasInclude: false,
    IGNORES: [] as string[],
    INCLUDES: [] as string[],
};

export async function walk(
    dir: string,
    opt = {} as { ignore?: string[]; includes?: string[] },
) {
    dir = path.normalize(dir);
    const { ignore, includes } = opt;
    if (ignore) {
        setIgnore(dir, ignore);
    }

    let file_list: string[] = [];

    if (includes) {
        for (let item of includes) {
            const include = path.join(dir, item);
            const sub_files = await walk(include);
            file_list = file_list.concat(sub_files);
        }

        return file_list;
    }

    const files = await readdir(dir);
    for (const file of files) {
        const file_path = path.join(dir, file);
        if (state.hasIgnore && isIgnore(file_path)) {
            continue;
        }

        const stat = await lstatFile(file_path);
        if (stat.isDirectory()) {
            const sub_files = await walk(file_path);
            file_list = file_list.concat(sub_files);
        } else {
            file_list.push(file_path);
        }
    }

    return file_list;
}

export function setIgnore(dir: string, ignores: string[]) {
    if (ignores?.length) {
        state.hasIgnore = true;
    }

    for (let item of ignores) {
        const ignore = path.join(dir, item);
        state.IGNORES.push(ignore);
    }
}

export function isIgnore(src_path: string) {
    for (const ignore of state.IGNORES) {
        if (isSubPath(src_path, ignore)) {
            return true;
        }
    }
    return false;
}
