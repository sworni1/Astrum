"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { categoryList } from "@/common/constants/category.list";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "../../../../../components/ui/button";
import { useState } from "react";

type FormValues = {
  search_query: string;
  category: string;
};

const MobileSearchbar = () => {
  const router = useRouter();
  const [openDialoog, setOpenDialoog] = useState(false);

  const form = useForm<FormValues>({
    defaultValues: {
      search_query: "",
      category: "all",
    },
  });

  const { control, handleSubmit } = form;

  const handleSearch = (values: FormValues) => {
    const { category, search_query } = values;

    const url = `/categories/${category}/?search_query=${encodeURIComponent(
      search_query,
    )}`;

    setOpenDialoog(false);

    router.push(url);
  };

  return (
    <div className="flex lg:hidden items-center justify-center">
      <Dialog open={openDialoog} onOpenChange={setOpenDialoog}>
        <DialogTrigger asChild>
          <Input
            type="search"
            placeholder="Search..."
            style={{
              userSelect: "none",
              cursor: "pointer",
            }}
            readOnly
          />
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Search products</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={handleSubmit(handleSearch)}
              className="grid gap-4 mt-5"
            >
              <FormField
                name="search_query"
                control={control}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="Search..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                name="category"
                control={control}
                render={({ field }) => (
                  <FormItem>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All</SelectItem>
                          {categoryList.map((category, idx) => (
                            <SelectItem key={idx} value={category.href}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="px-3 py-2 rounded-md border w-full"
              >
                Search
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MobileSearchbar;
